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
    
    // Generate OTP and set expiration (10 minutes from now)
    const otp = generateOTP();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);
    
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
    
    // Find the delivery with the given OTP
    const delivery = await prisma.delivery.findFirst({
      where: {
        otp,
        otpExpiresAt: {
          gte: new Date() // Only find non-expired OTPs
        }
      }
    });
    
    if (!delivery) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired OTP' },
        { status: 400 }
      );
    }
    
    // Clear the OTP after successful verification (one-time use)
    await prisma.delivery.update({
      where: { id: delivery.id },
      data: {
        otp: null,
        otpExpiresAt: null
      }
    });
    
    return NextResponse.json({ 
      success: true, 
      deliveryId: delivery.id.toString(),
      otp: otp // Include the OTP in the response
    });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to verify OTP' },
      { status: 500 }
    );
  }
}