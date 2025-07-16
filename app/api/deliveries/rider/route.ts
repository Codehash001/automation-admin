import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { activeNotifications } from '../utils';

const prisma = new PrismaClient();

// Handle rider response using phone number only
export async function PATCH(request: Request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (jsonError) {
      console.error('Invalid JSON received:', jsonError);
      return NextResponse.json(
        { 
          error: 'Invalid JSON format. Please ensure phone number is properly quoted.',
          details: 'Example: {"status":"REVIEWING","phone":"+1234567890"}'
        },
        { status: 400 }
      );
    }

    const { status, phone } = body;

    console.log(`=== RIDER PATCH REQUEST ===`);
    console.log(`Received status: ${status}`);
    console.log(`Received phone: ${phone}`);

    if (!phone) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Convert phone to standard format
    const riderPhone = phone.startsWith('+') ? phone : `+${phone}`;
    console.log(`Normalized phone: ${riderPhone}`);

    // Find the rider
    const rider = await prisma.driver.findUnique({
      where: { phone: riderPhone }
    });

    console.log(`Rider found:`, rider ? `ID: ${rider.id}, Name: ${rider.name}` : 'NOT FOUND');

    if (!rider) {
      return NextResponse.json(
        { error: 'Rider not found' },
        { status: 404 }
      );
    }

    // Get the delivery ID from database mapping
    console.log(`=== DATABASE MAPPING LOOKUP ===`);
    console.log(`Looking up mapping for phone: ${riderPhone}`);
    
    const mapping = await prisma.riderDeliveryMapping.findUnique({
      where: { phone: riderPhone }
    });
    
    console.log(`Mapping found:`, mapping);
    
    if (mapping) {
      console.log(`Mapping details:`, {
        deliveryId: mapping.deliveryId,
        expiresAt: mapping.expiresAt,
        isExpired: mapping.expiresAt < new Date(),
        currentTime: new Date()
      });
    }
    
    if (!mapping || mapping.expiresAt < new Date()) {
      console.log(`=== MAPPING FAILED ===`);
      console.log(`Mapping exists: ${!!mapping}`);
      if (mapping) {
        console.log(`Mapping expired: ${mapping.expiresAt < new Date()}`);
        console.log(`Expiry time: ${mapping.expiresAt}`);
        console.log(`Current time: ${new Date()}`);
        
        // Clean up expired mapping
        await prisma.riderDeliveryMapping.delete({
          where: { phone: riderPhone }
        });
      }
      
      return NextResponse.json(
        { 
          error: 'No active delivery found for this rider',
          debug: {
            phone: riderPhone,
            mappingExists: !!mapping,
            mappingExpired: mapping ? mapping.expiresAt < new Date() : null
          }
        },
        { status: 404 }
      );
    }

    const deliveryId = mapping.deliveryId;
    console.log(`Found delivery ID: ${deliveryId}`);

    // Find the delivery with complete order details
    const delivery = await prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: {
        order: {
          include: {
            customer: true,
            outlet: {
              include: {
                emirates: true
              }
            }
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

    // Handle REVIEWING status - return order details
    if (status === 'REVIEWING') {
      // Parse location string to get lat/lng separately
      const locationParts = delivery.order.deliveryLocation?.split(',') || [];
      const latitude = locationParts[0]?.trim() || '';
      const longitude = locationParts[1]?.trim() || '';
      
      return NextResponse.json({
        success: true,
        message: 'Order details retrieved for review',
        orderDetails: {
          orderId: delivery.order.id,
          customerLocation: {
            location: delivery.order.deliveryLocation, // GPS coordinates as "lat,lng" string
            latitude: latitude,
            longitude: longitude,
            address: delivery.order.deliveryAddress,   // Text address for reference
            customerName: delivery.order.customer.name,
            customerPhone: delivery.order.customer.whatsappNumber,
            buildingType: delivery.order.buildingType
          },
          outletLocation: {
            name: delivery.order.outlet.name,
            phone: delivery.order.outlet.whatsappNo,
            emirate: delivery.order.outlet.emirates.name,
            location: delivery.order.outlet.exactLocation // GPS coordinates as JSON object
          },
          deliveryInfo: {
            deliveryId: delivery.id,
            orderType: delivery.order.orderType,
            category: delivery.order.category,
            paymentMethod: delivery.order.paymentMethod,
            deliveryFee: delivery.order.deliveryFee,
            totalAmount: delivery.order.total,
            note: delivery.order.note
          }
        }
      });
    }

    // Handle ACCEPTED status
    if (status === 'ACCEPTED') {
      // Check if delivery is still available
      if (delivery.status !== 'PENDING') {
        return NextResponse.json({
          success: false,
          message: 'This delivery has already been assigned to another rider'
        });
      }

      // Clear the notification timeout for this delivery
      const notificationData = activeNotifications.get(deliveryId);
      if (notificationData) {
        clearTimeout(notificationData.timeoutId);
        activeNotifications.delete(deliveryId);
      }

      // Remove from database mapping
      await prisma.riderDeliveryMapping.delete({
        where: { phone: riderPhone }
      });

      // Assign delivery to rider
      await prisma.delivery.update({
        where: { id: deliveryId },
        data: {
          status: 'ACCEPTED',
          driverId: rider.id,
          updatedAt: new Date()
        }
      });

      return NextResponse.json({
        success: true,
        message: 'Delivery accepted successfully',
        deliveryId: deliveryId,
        riderName: rider.name,
        orderDetails: {
          orderId: delivery.order.id,
          customerLocation: delivery.order.deliveryLocation,
          outletName: delivery.order.outlet.name
        }
      });

    } else if (status === 'DECLINED') {
      // Remove from database mapping
      await prisma.riderDeliveryMapping.delete({
        where: { phone: riderPhone }
      });

      // Check if this delivery is still pending
      if (delivery.status !== 'PENDING') {
        return NextResponse.json({
          success: true,
          message: 'Delivery already handled'
        });
      }

      // Continue with next rider logic
      const notificationData = activeNotifications.get(deliveryId);
      if (notificationData) {
        clearTimeout(notificationData.timeoutId);
        
        const nextIndex = notificationData.currentIndex + 1;
        if (nextIndex < notificationData.drivers.length) {
          const nextDriver = notificationData.drivers[nextIndex];
          
          // Send notification to next driver with retry logic
          const SUB_FLOW_NS = process.env.WHATSAPP_FLOW_NS || 'your_default_flow_ns';
          const phoneWithoutPlus = nextDriver.phone.replace(/^\+/, '');
          
          try {
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
                    user_id: phoneWithoutPlus,
                    sub_flow_ns: SUB_FLOW_NS,
                    orderId: delivery.order.id.toString(),
                    deliveryId: delivery.id.toString(),
                    driverName: nextDriver.name
                  }),
                  signal: AbortSignal.timeout(10000) // 10 second timeout
                });
                
                if (response.ok) {
                  break; // Success, exit retry loop
                } else {
                  throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
              } catch (fetchError) {
                retryCount++;
                console.error(`Attempt ${retryCount} failed for driver ${nextDriver.id}:`, fetchError);
                
                if (retryCount >= maxRetries) {
                  throw fetchError; // Re-throw after max retries
                }
                
                // Wait before retry (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
              }
            }
            
            // Create database mapping for next driver
            const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
            const normalizedNextPhone = nextDriver.phone.startsWith('+') ? nextDriver.phone : `+${nextDriver.phone}`;
            
            await prisma.riderDeliveryMapping.upsert({
              where: { phone: normalizedNextPhone },
              update: { 
                deliveryId, 
                expiresAt 
              },
              create: {
                phone: normalizedNextPhone,
                deliveryId,
                expiresAt
              }
            });
            
            console.log(`Created database mapping for next driver: ${normalizedNextPhone} -> delivery: ${deliveryId}`);
            
            // Set new timeout for the next driver
            const timeoutId = setTimeout(() => {
              console.log(`No response from driver ${nextDriver.id} in 60 seconds, moving to next driver`);
              // This will be handled by the timeout logic in the main notification loop
            }, 60000); // 60 seconds timeout (1 minute)
            
            // Update notification tracking
            activeNotifications.set(deliveryId, {
              ...notificationData,
              timeoutId,
              currentIndex: nextIndex
            });
            
          } catch (error) {
            console.error('Error notifying next driver:', error);
            // Continue to next driver even if notification fails
            const nextNextIndex = nextIndex + 1;
            if (nextNextIndex < notificationData.drivers.length) {
              // Try the next driver after this one
              setTimeout(() => {
                // Recursive call to try next driver
                const nextNotificationData = activeNotifications.get(deliveryId);
                if (nextNotificationData) {
                  activeNotifications.set(deliveryId, {
                    ...nextNotificationData,
                    currentIndex: nextNextIndex
                  });
                }
              }, 1000);
            } else {
              // No more drivers available
              activeNotifications.delete(deliveryId);
              
              await prisma.delivery.update({
                where: { id: deliveryId },
                data: {
                  status: 'NO_RIDERS_AVAILABLE'
                }
              });
            }
          }
          
          return NextResponse.json({
            success: true,
            message: 'Delivery declined, notifying next rider'
          });
        } else {
          // No more riders available
          activeNotifications.delete(deliveryId);
          
          await prisma.delivery.update({
            where: { id: deliveryId },
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
      message: 'Invalid status. Use REVIEWING, ACCEPTED, or DECLINED'
    }, { status: 400 });

  } catch (error) {
    console.error('Error updating delivery status:', error);
    return NextResponse.json(
      { error: 'Failed to update delivery status' },
      { status: 500 }
    );
  }
}
