import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { activeNotifications } from './utils';

const prisma = new PrismaClient();

// Store active notification loops for tracking
// const activeNotifications = new Map<number, {
//   timeoutId: NodeJS.Timeout,
//   currentIndex: number,
//   drivers: Array<{ id: number; phone: string; name: string }>
// }>();

// Clean up expired mappings every minute
// setInterval(() => {
//   const now = new Date();
//   prisma.riderDeliveryMapping.deleteMany({
//     where: {
//       expiresAt: {
//         lt: now
//       }
//     }
//   });
// }, 60000);

export async function POST(request: Request) {
  try {
    const { orderId, emirateId } = await request.json();

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      );
    }

    // 1. Get order details
    const order = await prisma.order.findUnique({
      where: { id: Number(orderId) },
      include: {
        customer: true,
        outlet: true
      }
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Use the emirateId from the request or from the order if not provided
    const targetEmirateId = emirateId ? Number(emirateId) : order.emiratesId;

    // 2. Check if delivery already exists for this order
    const existingDelivery = await prisma.delivery.findUnique({
      where: { orderId: order.id },
    });

    if (existingDelivery) {
      return NextResponse.json(
        { error: 'A delivery already exists for this order' },
        { status: 400 }
      );
    }

    // 3. Create delivery record
    const delivery = await prisma.delivery.create({
      data: {
        status: 'PENDING',
        orderId: order.id,
      }
    });

    // 4. Find available delivery riders for this emirate
    const availableRiders = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || ''}/api/riders?available=true&driverType=DELIVERY&emirateId=${targetEmirateId}`, 
      { method: 'GET' }
    ).then(res => res.json());

    if (!availableRiders || availableRiders.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No available riders found',
        deliveryId: delivery.id
      });
    }

    // Format riders data for notification loop
    const driversData = availableRiders.map((rider: any) => ({
      id: rider.id,
      phone: rider.phone,
      name: rider.name
    }));

    // 5. Start notifying riders one by one with timeout
    startRiderNotificationLoop(
      delivery.id, 
      driversData, 
      order.id,
      order.customer.whatsappNumber,
      order.outlet.whatsappNo,
      order.deliveryLocation,
      order.deliveryAddress
    );

    return NextResponse.json({
      success: true,
      message: 'Delivery created and rider notification started',
      deliveryId: delivery.id,
      riders: driversData
    });

  } catch (error) {
    console.error('Error creating delivery:', error);
    return NextResponse.json(
      { error: 'Failed to create delivery' },
      { status: 500 }
    );
  }
}

// Function to handle the rider notification loop with timeouts
function startRiderNotificationLoop(
  deliveryId: number, 
  drivers: Array<{ id: number; phone: string; name: string }>,
  orderId: number,
  customerPhone: string,
  outletPhone: string,
  customerLocation: string | null,
  deliveryAddress: string | null
) {
  if (drivers.length === 0) {
    console.log(`No available drivers for delivery ${deliveryId}`);
    return;
  }

  let currentIndex = 0;
  const SUB_FLOW_NS = process.env.WHATSAPP_FLOW_NS || 'your_default_flow_ns';
  
  // Function to notify the next driver
  const notifyNextDriver = async () => {
    if (currentIndex >= drivers.length) {
      console.log(`All drivers notified for delivery ${deliveryId}, none accepted`);
      // Clean up the notification tracking
      activeNotifications.delete(deliveryId);
      return;
    }

    const driver = drivers[currentIndex];
    
    try {
      // Send WhatsApp notification - remove the + sign from phone number
      const phoneWithoutPlus = driver.phone.replace(/^\+/, '');
      
      // Add retry logic for network issues
      let retryCount = 0;
      const maxRetries = 3;
      let response;
      
      while (retryCount < maxRetries) {
        try {
          response = await fetch('https://www.uchat.com.au/api/subscriber/send-sub-flow-by-user-id', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.UCHAT_API_KEY}`
            },
            body: JSON.stringify({
              user_id: phoneWithoutPlus, // Phone number without + sign
              sub_flow_ns: SUB_FLOW_NS,
              orderId: orderId.toString(),
              deliveryId: deliveryId.toString(),
              driverName: driver.name
            }),
            // Add timeout to prevent hanging
            signal: AbortSignal.timeout(10000) // 10 second timeout
          });
          
          if (response.ok) {
            break; // Success, exit retry loop
          } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
        } catch (fetchError) {
          retryCount++;
          console.error(`Attempt ${retryCount} failed for driver ${driver.id}:`, fetchError);
          
          if (retryCount >= maxRetries) {
            throw fetchError; // Re-throw after max retries
          }
          
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }

      if (!response || !response.ok) {
        console.error(`Failed to send notification to driver ${driver.id} after ${maxRetries} attempts`);
        // Continue to next driver instead of stopping the whole process
        currentIndex++;
        setTimeout(notifyNextDriver, 1000);
        return;
      } else {
        console.log(`Notification sent to driver ${driver.id} (${driver.phone})`);
        
        // Create phone-to-delivery mapping in database (expires in 5 minutes)
        // Normalize phone format to match lookup format
        const normalizedPhone = driver.phone.startsWith('+') ? driver.phone : `+${driver.phone}`;
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
        
        try {
          await prisma.riderDeliveryMapping.upsert({
            where: { phone: normalizedPhone },
            update: { 
              deliveryId, 
              expiresAt 
            },
            create: {
              phone: normalizedPhone,
              deliveryId,
              expiresAt
            }
          });
          
          console.log(`Created database mapping for phone: ${normalizedPhone} -> delivery: ${deliveryId}`);
        } catch (dbError) {
          console.error('Error creating database mapping:', dbError);
        }
      }

      // Set timeout for 1 minute before moving to next driver
      const timeoutId = setTimeout(() => {
        console.log(`No response from driver ${driver.id} in 60 seconds, moving to next driver`);
        currentIndex++;
        notifyNextDriver();
      }, 60000); // 60 seconds timeout (1 minute)

      // Update active notification tracking
      activeNotifications.set(deliveryId, {
        timeoutId,
        currentIndex,
        drivers
      });

    } catch (error) {
      console.error('Error sending notification:', error);
      // Move to next driver even if current one fails
      currentIndex++;
      setTimeout(notifyNextDriver, 1000); // Short delay before trying next driver
    }
  };

  // Start the notification loop
  notifyNextDriver();
}

// Get all deliveries
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const deliveryId = searchParams.get('id');

    if (deliveryId) {
      // If specific delivery ID is requested, redirect to dynamic route
      return NextResponse.json({
        message: 'Use /api/deliveries/rider for rider responses'
      }, { status: 301 });
    }

    // Fetch all deliveries
    const deliveries = await prisma.delivery.findMany({
      include: {
        order: {
          include: {
            customer: true,
            outlet: true,
            emirates: true
          }
        },
        driver: true
      }
    });
    
    return NextResponse.json(deliveries);

  } catch (error) {
    console.error('Error fetching deliveries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deliveries' },
      { status: 500 }
    );
  }
}