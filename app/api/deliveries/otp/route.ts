// app/api/deliveries/otp/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Generate a random 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(req: Request) {
  try {
    const { deliveryId } = await req.json();
    
    if (!deliveryId) {
      return NextResponse.json(
        { success: false, error: 'Delivery ID is required' },
        { status: 400 }
      );
    }
    
    // Generate OTP and set expiration (120 minutes from now)
    const otp = generateOTP();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 120);
    
    // Update the delivery record with the new OTP and expiration
    await prisma.delivery.update({
      where: { id: Number(deliveryId) },
      data: {
        otp,
        otpExpiresAt: expiresAt
      }
    });
    
    // In production, integrate with WhatsApp API here to send OTP to rider
    // await sendWhatsAppOTP(riderPhone, otp);
    
    return NextResponse.json({ 
      success: true, 
      otp: otp // Include the OTP in the response for development/testing
    });
  } catch (error) {
    console.error('Error generating OTP:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate OTP' },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const { otp } = await req.json();

    if (!otp) {
      return NextResponse.json(
        { success: false, error: 'OTP is required' },
        { status: 400 }
      );
    }

    // Find delivery with matching OTP that hasn't expired
    const delivery = await prisma.delivery.findFirst({
      where: {
        otp,
        otpExpiresAt: {
          gt: new Date(), // OTP not expired
        },
      },
      include: {
        order: {
          include: {
            customer: true,
            outlet: true,
            emirates: true,
          },
        },
        driver: true,
      },
    });

    if (!delivery) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired OTP' },
        { status: 404 }
      );
    }

    // OTP is valid, clear it to prevent reuse
    await prisma.delivery.update({
      where: { id: delivery.id },
      data: {
        status: 'IN_TRANSIT',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'OTP verified successfully',
      deliveryId: delivery.id,
      delivery: {
        id: delivery.id,
        status: delivery.status,
        driver: delivery.driver ? {
          id: delivery.driver.id,
          name: delivery.driver.name,
          phone: delivery.driver.phone,
          liveLocation: delivery.driver.liveLocation,
        } : null,
        order: {
          id: delivery.order.id,
          status: delivery.order.status,
          customer: {
            id: delivery.order.customer.id,
            name: delivery.order.customer.name,
            phone: delivery.order.customer.whatsappNumber,
            location: delivery.order.deliveryLocation,
            address: delivery.order.deliveryAddress,
          },
          outlet: {
            id: delivery.order.outlet?.id,
            name: delivery.order.outlet?.name,
            address: delivery.order.outlet?.exactLocation,
          },
          emirates: delivery.order.emirates,
        },
        createdAt: delivery.createdAt,
        updatedAt: delivery.updatedAt,
      },
    });

  } catch (error) {
    console.error('Error verifying OTP:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to verify OTP' },
      { status: 500 }
    );
  }
}