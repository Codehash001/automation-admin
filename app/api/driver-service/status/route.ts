import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Allowed ride statuses (align with your app's UI/logic)
const ALLOWED_STATUSES = [
  'PENDING',        // Created
  'PICKING_UP',     // OTP generated / driver heading to pickup
  'IN_PROGRESS',    // With passenger
  'COMPLETED',      // Dropped off
  'CANCELLED',      // Cancelled by user/admin
  'NO_RIDERS_AVAILABLE', // Auto-set when notification loop exhausts
] as const;

export type RideStatus = typeof ALLOWED_STATUSES[number];

interface UpdateRideStatusRequest {
  rideRequestId: number;
  status: RideStatus;
}

export async function PUT(req: Request) {
  try {
    const { rideRequestId, status } = (await req.json()) as UpdateRideStatusRequest;

    if (!rideRequestId) {
      return NextResponse.json(
        { success: false, error: 'Ride request ID is required' },
        { status: 400 }
      );
    }

    if (!status || !ALLOWED_STATUSES.includes(status)) {
      return NextResponse.json(
        { success: false, error: `Invalid status. Allowed: ${ALLOWED_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    const ride = await prisma.rideRequest.findUnique({ where: { id: Number(rideRequestId) } });
    if (!ride) {
      return NextResponse.json({ success: false, error: 'Ride not found' }, { status: 404 });
    }

    const updated = await prisma.rideRequest.update({
      where: { id: Number(rideRequestId) },
      data: { status, updatedAt: new Date() },
    });

    return NextResponse.json({ success: true, ride: updated });
  } catch (e) {
    console.error('Error updating ride status:', e);
    return NextResponse.json(
      { success: false, error: 'Failed to update ride status' },
      { status: 500 }
    );
  }
}
