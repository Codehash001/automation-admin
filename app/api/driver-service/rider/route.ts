import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { activeNotifications } from '../../deliveries/utils';

// PATCH /api/driver-service/rider
// Body: { phone: string, status: 'REVIEWING'|'ACCEPTED'|'DECLINED' }
export async function PATCH(request: Request) {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON format. Example: {"status":"REVIEWING","phone":"+1234567890"}' },
        { status: 400 }
      );
    }

    const { status, phone } = body;
    if (!phone) return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });

    const riderPhone = phone.startsWith('+') ? phone : `+${phone}`;

    const rider = await prisma.driver.findUnique({ where: { phone: riderPhone } });
    if (!rider) return NextResponse.json({ error: 'Rider not found' }, { status: 404 });

    const mapping = await prisma.riderRideMapping.findUnique({ where: { phone: riderPhone } });
    if (!mapping || mapping.expiresAt < new Date()) {
      if (mapping) {
        await prisma.riderRideMapping.delete({ where: { phone: riderPhone } });
      }
      return NextResponse.json({ error: 'No active ride found for this rider' }, { status: 404 });
    }

    const rideRequestId = mapping.rideRequestId;

    const ride = await prisma.rideRequest.findUnique({
      where: { id: rideRequestId },
      include: { driver: true },
    });
    if (!ride) return NextResponse.json({ error: 'Ride not found' }, { status: 404 });

    // REVIEWING → return details
    if (status === 'REVIEWING') {
      return NextResponse.json({
        success: true,
        message: 'Ride details retrieved for review',
        rideDetails: {
          rideRequestId: ride.id,
          pickupAddress: ride.pickupAddress || '',
          dropoffAddress: ride.dropoffAddress || '',
          customerPhone: ride.customerPhone || '',
          status: ride.status,
        },
      });
    }

    // ACCEPTED → assign and stop loop
    if (status === 'ACCEPTED') {
      if (ride.status !== 'PENDING') {
        return NextResponse.json({
          success: false,
          message: 'This ride has already been assigned',
        });
      }

      const notificationData = activeNotifications.get(rideRequestId);
      if (notificationData) {
        clearTimeout(notificationData.timeoutId);
        activeNotifications.delete(rideRequestId);
      }

      await prisma.riderRideMapping.delete({ where: { phone: riderPhone } });

      await prisma.rideRequest.update({
        where: { id: rideRequestId },
        data: { status: 'ACCEPTED', driverId: rider.id, updatedAt: new Date() },
      });

      return NextResponse.json({
        success: true,
        message: 'Ride accepted successfully',
        rideRequestId,
        riderName: rider.name,
      });
    }

    // DECLINED → notify next rider
    if (status === 'DECLINED') {
      await prisma.riderRideMapping.delete({ where: { phone: riderPhone } });

      if (ride.status !== 'PENDING') {
        return NextResponse.json({ success: true, message: 'Ride already handled' });
      }

      const notificationData = activeNotifications.get(rideRequestId);
      if (notificationData) {
        clearTimeout(notificationData.timeoutId);

        const nextIndex = notificationData.currentIndex + 1;
        if (nextIndex < notificationData.drivers.length) {
          const nextDriver = notificationData.drivers[nextIndex];
          const RIDE_SUB_FLOW_NS = process.env.WHATSAPP_RIDE_FLOW_NS || 'f184527s2614359';
          const phoneWithoutPlus = nextDriver.phone.replace(/^\+/, '');

          try {
            // Retry logic
            let retry = 0;
            const maxRetries = 3;
            let response: Response | undefined;

            while (retry < maxRetries) {
              try {
                response = await fetch('https://www.uchat.com.au/api/subscriber/send-sub-flow-by-user-id', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.UCHAT_API_KEY}`,
                  },
                  body: JSON.stringify({
                    user_id: phoneWithoutPlus,
                    sub_flow_ns: RIDE_SUB_FLOW_NS,
                    rideRequestId: rideRequestId.toString(),
                    driverName: nextDriver.name,
                  }),
                  signal: AbortSignal.timeout(10000),
                });
                if (response.ok) break;
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
              } catch (err) {
                retry++;
                if (retry >= maxRetries) throw err;
                await new Promise(res => setTimeout(res, 1000 * retry));
              }
            }

            const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
            const normalizedNextPhone = nextDriver.phone.startsWith('+') ? nextDriver.phone : `+${nextDriver.phone}`;

            await prisma.riderRideMapping.upsert({
              where: { phone: normalizedNextPhone },
              update: { rideRequestId, expiresAt },
              create: { phone: normalizedNextPhone, rideRequestId, expiresAt },
            });

            const timeoutId = setTimeout(() => {
              // Moving to next will be handled by the loop logic when invoked by the creator route
            }, 60000);

            activeNotifications.set(rideRequestId, {
              ...notificationData,
              timeoutId,
              currentIndex: nextIndex,
            });

            return NextResponse.json({
              success: true,
              message: 'Ride declined, notifying next rider',
            });
          } catch (err) {
            console.error('Error notifying next ride driver:', err);
            // If no more drivers after errors
            activeNotifications.delete(rideRequestId);
            await prisma.rideRequest.update({
              where: { id: rideRequestId },
              data: { status: 'NO_RIDERS_AVAILABLE' },
            });
            return NextResponse.json({
              success: true,
              message: 'No more riders available',
            });
          }
        } else {
          // No more drivers available
          activeNotifications.delete(rideRequestId);
          await prisma.rideRequest.update({
            where: { id: rideRequestId },
            data: { status: 'NO_RIDERS_AVAILABLE' },
          });
          return NextResponse.json({
            success: true,
            message: 'All riders declined the ride',
          });
        }
      }

      return NextResponse.json({ success: true, message: 'Ride declined by rider' });
    }

    return NextResponse.json(
      { success: false, message: 'Invalid status. Use REVIEWING, ACCEPTED, or DECLINED' },
      { status: 400 }
    );
  } catch (e) {
    console.error('Error updating ride status:', e);
    return NextResponse.json({ error: 'Failed to update ride status' }, { status: 500 });
  }
}