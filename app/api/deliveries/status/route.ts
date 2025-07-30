import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Define valid delivery statuses
type DeliveryStatus = 'PENDING' | 'ASSIGNED' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';

interface UpdateStatusRequest {
  deliveryId: number;
  status: DeliveryStatus;
}

export async function PUT(req: Request) {
  try {
    const { deliveryId, status } = await req.json() as UpdateStatusRequest;
    
    // Validate required fields
    if (!deliveryId) {
      return NextResponse.json(
        { success: false, error: 'Delivery ID is required' },
        { status: 400 }
      );
    }

    if (!status) {
      return NextResponse.json(
        { success: false, error: 'Status is required' },
        { status: 400 }
      );
    }

    // First, get the delivery with its order ID
    const delivery = await prisma.delivery.findUnique({
      where: { id: Number(deliveryId) },
      include: {
        order: {
          select: { id: true }
        }
      }
    });

    if (!delivery) {
      return NextResponse.json(
        { success: false, error: 'Delivery not found' },
        { status: 404 }
      );
    }

    // Update both delivery and order status in a transaction
    const [updatedDelivery] = await prisma.$transaction([
      // Update delivery status
      prisma.delivery.update({
        where: { id: Number(deliveryId) },
        data: { 
          status,
          updatedAt: new Date() 
        },
        include: {
          order: true,
          driver: true,
        },
      }),
      // Also update the related order status if delivery is marked as DELIVERED
      ...(status === 'DELIVERED' ? [
        prisma.order.update({
          where: { id: delivery.order.id },
          data: { 
            status: 'COMPLETED',
            updatedAt: new Date() 
          },
        })
      ] : [])
    ]);

    return NextResponse.json({
      success: true,
      data: updatedDelivery,
    });
  } catch (error) {
    console.error('Error updating delivery status:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update delivery status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const deliveryId = searchParams.get('deliveryId');

    if (!deliveryId) {
      return NextResponse.json(
        { success: false, error: 'Delivery ID is required' },
        { status: 400 }
      );
    }

    const delivery = await prisma.delivery.findUnique({
      where: { id: Number(deliveryId) },
      include: {
        order: {
          include: {
            customer: true,
            outlet: true,
          },
        },
        driver: true,
      },
    });

    if (!delivery) {
      return NextResponse.json(
        { success: false, error: 'Delivery not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: delivery,
    });
  } catch (error) {
    console.error('Error fetching delivery status:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch delivery status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
