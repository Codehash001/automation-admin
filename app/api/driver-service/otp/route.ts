import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST /api/driver-service/otp { rideRequestId }
export async function POST(req: Request) {
  try {
    const { rideRequestId } = await req.json();
    if (!rideRequestId) {
      return NextResponse.json({ success: false, error: 'Ride request ID is required' }, { status: 400 });
    }

    const ride = await prisma.rideRequest.findUnique({ where: { id: Number(rideRequestId) } });
    if (!ride) return NextResponse.json({ success: false, error: 'Ride not found' }, { status: 404 });

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 120 * 60 * 1000); // 120 minutes

    await prisma.rideRequest.update({
      where: { id: Number(rideRequestId) },
      data: { otp, otpExpiresAt: expiresAt, status: 'PICKING_UP' },
    });

    return NextResponse.json({ success: true, otp });
  } catch (e) {
    console.error('Error generating ride OTP:', e);
    return NextResponse.json({ success: false, error: 'Failed to generate OTP' }, { status: 500 });
  }
}

// PUT /api/driver-service/otp { otp }
export async function PUT(req: Request) {
  try {
    const { otp } = await req.json();
    if (!otp) return NextResponse.json({ success: false, error: 'OTP is required' }, { status: 400 });

    const ride = await prisma.rideRequest.findFirst({
      where: { otp, otpExpiresAt: { gt: new Date() } },
      include: { driver: true },
    });

    if (!ride) return NextResponse.json({ success: false, error: 'Invalid or expired OTP' }, { status: 404 });

    return NextResponse.json({
      success: true,
      message: 'OTP verified successfully',
      rideRequestId: ride.id,
      ride: {
        id: ride.id,
        status: ride.status,
        driver: ride.driver ? {
          id: ride.driver.id,
          name: ride.driver.name,
          phone: ride.driver.phone,
          liveLocation: ride.driver.liveLocation,
        } : null,
        customerPhone: ride.customerPhone,
        pickupLocation: ride.pickupLocation,
        dropoffLocation: ride.dropoffLocation,
        createdAt: ride.createdAt,
        updatedAt: ride.updatedAt,
      },
    });
  } catch (e) {
    console.error('Error verifying ride OTP:', e);
    return NextResponse.json({ success: false, error: 'Failed to verify OTP' }, { status: 500 });
  }
}
