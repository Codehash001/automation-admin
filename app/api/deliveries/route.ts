import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Store active notification loops for tracking
const activeNotifications = new Map<number, {
  timeoutId: NodeJS.Timeout,
  currentIndex: number,
  drivers: Array<{ id: number; phone: string; name: string }>
}>();

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
      totalRidersAvailable: driversData.length
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
      }

      // Set timeout for 30 seconds before moving to next driver
      const timeoutId = setTimeout(() => {
        console.log(`No response from driver ${driver.id} in 30 seconds, moving to next driver`);
        currentIndex++;
        notifyNextDriver();
      }, 30000); // 30 seconds timeout

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

// Endpoint to update delivery status based on driver response
export async function PATCH(request: Request) {
  try {
    const data = await request.json();
    const { userId, status, deliveryId, phone } = data;
    
    // Handle case where only phone is provided (for reviewing)
    if (phone && !userId && !deliveryId) {
      // Convert phone to standard format with + prefix if needed
      const riderPhone = phone.startsWith('+') ? phone : `+${phone}`;
      
      // Find the rider by phone
      const rider = await prisma.driver.findUnique({
        where: { phone: riderPhone },
      });

      if (!rider) {
        return NextResponse.json(
          { error: 'Rider not found with the provided phone number' },
          { status: 404 }
        );
      }
      
      // Find the most recent pending delivery that this rider was notified about
      // Since we don't have deliveryId, we'll find the latest one that matches the driver
      const activeDelivery = await prisma.delivery.findFirst({
        where: {
          status: 'PENDING',
          // No driver assigned yet or this specific driver
          OR: [
            { driverId: null },
            { driverId: rider.id }
          ]
        },
        orderBy: {
          createdAt: 'desc'
        },
        include: {
          order: {
            include: {
              customer: true,
              outlet: true
            }
          }
        }
      });
      
      if (!activeDelivery) {
        return NextResponse.json(
          { error: 'No active delivery found for this rider' },
          { status: 404 }
        );
      }
      
      // Update delivery with the current rider ID
      await prisma.delivery.update({
        where: { id: activeDelivery.id },
        data: {
          driverId: rider.id,
          status: 'REVIEWING'
        }
      });
      
      // Check if there's an active notification loop for this delivery
      const notificationData = activeNotifications.get(activeDelivery.id);
      if (notificationData && notificationData.timeoutId) {
        clearTimeout(notificationData.timeoutId);
      }
      
      // Prepare order details for the rider
      const orderDetails = {
        customerPhone: activeDelivery.order.customer.whatsappNumber,
        outletPhone: activeDelivery.order.outlet.whatsappNo,
        customerLocation: activeDelivery.order.deliveryLocation,
        deliveryAddress: activeDelivery.order.deliveryAddress,
        deliveryId: activeDelivery.id // Return deliveryId for subsequent calls
      };
      
      return NextResponse.json({
        success: true,
        message: 'Delivery is being reviewed by rider',
        orderDetails
      });
    }
    
    // Handle the original case where userId, status, and deliveryId are provided
    if (!userId && !phone) {
      return NextResponse.json(
        { error: 'Either userId or phone is required' },
        { status: 400 }
      );
    }
    
    if (!status) {
      return NextResponse.json(
        { error: 'status is required' },
        { status: 400 }
      );
    }
    
    // If we have userId but no phone, set phone from userId
    const phoneToUse = phone || userId;
    
    // Convert to phone number format with + prefix
    const riderPhone = phoneToUse.startsWith('+') ? phoneToUse : `+${phoneToUse}`;
    
    // Find the rider by phone number
    const rider = await prisma.driver.findUnique({
      where: { phone: riderPhone },
    });

    if (!rider) {
      return NextResponse.json(
        { error: 'Rider not found with the provided phone number' },
        { status: 404 }
      );
    }

    // If deliveryId is not provided, find the active delivery for this rider
    let delivery;
    if (!deliveryId) {
      delivery = await prisma.delivery.findFirst({
        where: {
          driverId: rider.id,
          status: 'REVIEWING'
        },
        include: {
          order: {
            include: {
              customer: true,
              outlet: true
            }
          }
        },
        orderBy: {
          updatedAt: 'desc'
        }
      });
      
      if (!delivery) {
        return NextResponse.json(
          { error: 'No active delivery found for this rider' },
          { status: 404 }
        );
      }
    } else {
      // If deliveryId is provided, use it
      delivery = await prisma.delivery.findUnique({
        where: { id: Number(deliveryId) },
        include: {
          order: {
            include: {
              customer: true,
              outlet: true
            }
          }
        }
      });

      if (!delivery) {
        return NextResponse.json(
          { error: 'Delivery not found' },
          { status: 404 }
        );
      }
    }

    // Check if there's an active notification loop for this delivery
    const notificationData = activeNotifications.get(delivery.id);
    
    // Handle based on status
    if (status.toLowerCase() === 'reviewing') {
      // Update delivery with the current rider ID
      await prisma.delivery.update({
        where: { id: delivery.id },
        data: {
          driverId: rider.id,
          status: 'REVIEWING'
        }
      });
      
      // Prepare order details for the rider
      const orderDetails = {
        customerPhone: delivery.order.customer.whatsappNumber,
        outletPhone: delivery.order.outlet.whatsappNo,
        customerLocation: delivery.order.deliveryLocation,
        deliveryAddress: delivery.order.deliveryAddress,
        deliveryId: delivery.id // Return deliveryId for subsequent calls
      };
      
      return NextResponse.json({
        success: true,
        message: 'Delivery is being reviewed by rider',
        orderDetails
      });
    } 
    else if (status.toUpperCase() === 'ACCEPTED') {
      // Stop the notification loop
      if (notificationData && notificationData.timeoutId) {
        clearTimeout(notificationData.timeoutId);
        activeNotifications.delete(delivery.id);
      }
      
      // Update delivery status and assign the rider
      await prisma.delivery.update({
        where: { id: delivery.id },
        data: {
          status: 'ACCEPTED',
          driverId: rider.id
        }
      });
      
      return NextResponse.json({
        success: true,
        message: 'Delivery accepted by rider'
      });
    }
    else if (status.toUpperCase() === 'DECLINED') {
      // If the current rider declines, move to the next rider in the queue
      if (notificationData) {
        clearTimeout(notificationData.timeoutId);
        
        // Move to next rider
        const nextIndex = notificationData.currentIndex + 1;
        if (nextIndex < notificationData.drivers.length) {
          // Update current index and restart notification loop
          activeNotifications.set(delivery.id, {
            ...notificationData,
            currentIndex: nextIndex
          });
          
          // Notify next rider
          const nextDriver = notificationData.drivers[nextIndex];
          const SUB_FLOW_NS = process.env.WHATSAPP_FLOW_NS || 'your_default_flow_ns';
          
          // Send notification to next driver
          const phoneWithoutPlus = nextDriver.phone.replace(/^\+/, '');
          
          await fetch('https://www.uchat.com.au/api/subscriber/send-sub-flow-by-user-id', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.UCHAT_API_KEY}`
            },
            body: JSON.stringify({
              user_id: phoneWithoutPlus,
              sub_flow_ns: SUB_FLOW_NS,
              orderId: delivery.orderId.toString(),
              deliveryId: delivery.id.toString(),
              driverName: nextDriver.name
            })
          });
          
          // Set new timeout for the next driver
          const timeoutId = setTimeout(() => {
            console.log(`No response from driver ${nextDriver.id} in 30 seconds, moving to next driver`);
            const currentNotificationData = activeNotifications.get(delivery.id);
            if (currentNotificationData) {
              activeNotifications.set(delivery.id, {
                ...currentNotificationData,
                currentIndex: currentNotificationData.currentIndex + 1
              });
              
              // Recursively continue with the next driver
              startRiderNotificationLoop(
                delivery.id,
                notificationData.drivers.slice(nextIndex + 1),
                delivery.orderId,
                delivery.order.customer.whatsappNumber,
                delivery.order.outlet.whatsappNo,
                delivery.order.deliveryLocation,
                delivery.order.deliveryAddress
              );
            }
          }, 30000);
          
          // Update timeout ID
          activeNotifications.set(delivery.id, {
            ...activeNotifications.get(delivery.id)!,
            timeoutId
          });
          
          return NextResponse.json({
            success: true,
            message: 'Delivery declined, notifying next rider'
          });
        } else {
          // No more riders to notify
          activeNotifications.delete(delivery.id);
          
          await prisma.delivery.update({
            where: { id: delivery.id },
            data: {
              status: 'NO_RIDERS_AVAILABLE'
            }
          });
          
          return NextResponse.json({
            success: true,
            message: 'All riders declined the delivery'
          });
        }
      }
      
      return NextResponse.json({
        success: true,
        message: 'Delivery declined by rider'
      });
    }
    
    return NextResponse.json({
      success: false,
      message: 'Invalid status'
    }, { status: 400 });

  } catch (error) {
    console.error('Error updating delivery status:', error);
    return NextResponse.json(
      { error: 'Failed to update delivery status' },
      { status: 500 }
    );
  }
}

// Endpoint to get delivery status
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const deliveryId = searchParams.get('id');

    if (!deliveryId) {
      // Fetch all deliveries if no ID is provided
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
    }

    const delivery = await prisma.delivery.findUnique({
      where: { id: Number(deliveryId) },
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

    if (!delivery) {
      return NextResponse.json(
        { error: 'Delivery not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(delivery);

  } catch (error) {
    console.error('Error fetching delivery:', error);
    return NextResponse.json(
      { error: 'Failed to fetch delivery' },
      { status: 500 }
    );
  }
}