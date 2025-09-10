import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { activeNotifications } from '../deliveries/utils';

// POST /api/driver-service
// Body: { emirateId: number, vehicleTypeId?: number, category?: 'TRADITIONAL_TAXI'|'LIMOUSINE', customerPhone?: string, pickupLocation?: string, dropoffLocation?: string }
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { emirateId, vehicleTypeId, category, customerPhone, pickupLocation, dropoffLocation } = body as any;

    if (!emirateId) {
      return NextResponse.json({ error: 'emirateId is required' }, { status: 400 });
    }
    if (category && !['TRADITIONAL_TAXI', 'LIMOUSINE'].includes(category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }

    // Validate vehicle type if provided and capture its category
    let requestedVt: { id: number; category: 'TRADITIONAL_TAXI'|'LIMOUSINE'; name: string; capacity: number } | null = null;
    if (vehicleTypeId) {
      const vt = await prisma.vehicleType.findUnique({ where: { id: Number(vehicleTypeId) } });
      if (!vt) return NextResponse.json({ error: 'Invalid vehicleTypeId' }, { status: 400 });
      requestedVt = { id: vt.id, category: vt.category as any, name: vt.name, capacity: vt.capacity };
    }

    // 1) Create ride request
    const ride = await prisma.rideRequest.create({
      data: {
        status: 'PENDING',
        customerPhone: customerPhone || null,
        pickupLocation: pickupLocation || null,
        dropoffLocation: dropoffLocation || null,
        requestedVehicleTypeRefId: requestedVt?.id ?? null,
      },
    });

    // 2) Find available ride-service riders for this emirate
    const riders = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || ''}/api/riders?available=true&driverType=RIDE_SERVICE&emirateId=${Number(emirateId)}`,
      { method: 'GET' }
    ).then(r => r.json());

    let availableRiders: Array<{ id: number; name: string; phone: string; rideServiceCategory?: string | null }>
      = Array.isArray(riders) ? riders : [];

    if (requestedVt) {
      // Exact vehicle type match takes priority
      availableRiders = availableRiders.filter((r: any) => r.rideVehicleTypeRefId === requestedVt!.id);
    } else if (category) {
      availableRiders = availableRiders.filter((r: any) => r.rideServiceCategory === category);
    }

    if (!availableRiders || availableRiders.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No available ride-service riders found',
        rideRequestId: ride.id,
      });
    }

    const driversData = availableRiders.map(r => ({ id: r.id, phone: r.phone, name: r.name }));

    // 3) Start notifying riders sequentially
    startRideNotificationLoop(
      ride.id,
      driversData,
      { customerPhone: customerPhone || '', pickupLocation: pickupLocation || '', dropoffLocation: dropoffLocation || '' }
    );

    return NextResponse.json({
      success: true,
      message: 'Ride request created and rider notification started',
      rideRequestId: ride.id,
      riders: driversData,
      requestedVehicleType: requestedVt ?? undefined,
    });
  } catch (e) {
    console.error('Error creating ride request:', e);
    return NextResponse.json({ error: 'Failed to create ride request' }, { status: 500 });
  }
}

// GET /api/driver-service
// Optional: ?id=123 or ?status=PENDING
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const status = searchParams.get('status');

    if (id) {
      const ride = await prisma.rideRequest.findUnique({
        where: { id: Number(id) },
        include: { driver: true, requestedVehicleType: true },
      });
      if (!ride) return NextResponse.json({ error: 'Ride not found' }, { status: 404 });
      return NextResponse.json(ride);
    }

    const rides = await prisma.rideRequest.findMany({
      where: status ? { status } : undefined,
      include: { driver: true, requestedVehicleType: true },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(rides);
  } catch (e) {
    console.error('Error fetching rides:', e);
    return NextResponse.json({ error: 'Failed to fetch rides' }, { status: 500 });
  }
}

// PATCH /api/driver-service
// Body: { id: number (rideRequestId), liveLocation: { latitude: number, longitude: number } }
export async function PATCH(request: Request) {
  try {
    const { id, liveLocation } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Ride request ID is required' },
        { status: 400 }
      );
    }

    if (!liveLocation || !liveLocation.latitude || !liveLocation.longitude) {
      return NextResponse.json(
        { error: 'Live location with latitude and longitude is required' },
        { status: 400 }
      );
    }

    const ride = await prisma.rideRequest.findUnique({
      where: { id: Number(id) },
      include: { driver: true },
    });
    if (!ride) return NextResponse.json({ error: 'Ride not found' }, { status: 404 });
    if (!ride.driver) return NextResponse.json({ error: 'No driver assigned to this ride' }, { status: 400 });

    const locationString = `${liveLocation.latitude},${liveLocation.longitude}`;
    await prisma.driver.update({
      where: { id: ride.driver.id },
      data: { liveLocation: locationString, updatedAt: new Date() },
    });

    return NextResponse.json({ success: true, message: 'Driver live location updated' });
  } catch (e) {
    console.error('Error updating driver live location:', e);
    return NextResponse.json({ error: 'Failed to update driver live location' }, { status: 500 });
  }
}

function startRideNotificationLoop(
  rideRequestId: number,
  drivers: Array<{ id: number; phone: string; name: string }>,
  context: { customerPhone: string; pickupLocation: string; dropoffLocation: string }
) {
  if (!drivers.length) {
    console.log(`No available drivers for ride ${rideRequestId}`);
    return;
  }

  let currentIndex = 0;
  const RIDE_SUB_FLOW_NS = process.env.WHATSAPP_RIDE_FLOW_NS || 'f184527s2614359';

  const notifyNext = async () => {
    if (currentIndex >= drivers.length) {
      console.log(`All drivers notified for ride ${rideRequestId}, none accepted`);
      activeNotifications.delete(rideRequestId);
      return;
    }

    const driver = drivers[currentIndex];
    try {
      const phoneWithoutPlus = driver.phone.replace(/^\+/, '');

      // Retry logic
      let retry = 0; const maxRetries = 3; let response: Response | undefined;
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
              driverName: driver.name,
              pickupLocation: context.pickupLocation,
              dropoffLocation: context.dropoffLocation,
            }),
            signal: AbortSignal.timeout(10000),
          });
          if (response.ok) break;
          throw new Error(`HTTP ${response.status}`);
        } catch (err) {
          retry++;
          if (retry >= maxRetries) throw err;
          await new Promise(r => setTimeout(r, 1000 * retry));
        }
      }

      const normalizedPhone = driver.phone.startsWith('+') ? driver.phone : `+${driver.phone}`;
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      await prisma.riderRideMapping.upsert({
        where: { phone: normalizedPhone },
        update: { rideRequestId, expiresAt },
        create: { phone: normalizedPhone, rideRequestId, expiresAt },
      });

      // 60s timeout to move to next
      const timeoutId = setTimeout(() => {
        currentIndex++;
        notifyNext();
      }, 60000);

      activeNotifications.set(rideRequestId, { timeoutId, currentIndex, drivers });
    } catch (e) {
      console.error('Error notifying ride driver:', e);
      currentIndex++;
      setTimeout(notifyNext, 1000);
    }
  };

  notifyNext();
}