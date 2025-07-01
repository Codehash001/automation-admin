import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const deliveries = await prisma.delivery.findMany({
      include: {
        order: {
          include: {
            customer: true,
            outlet: true,
            items: {
              include: {
                menuItem: true
              }
            }
          }
        },
        driver: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    return NextResponse.json(deliveries);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Failed to fetch deliveries' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const {
      orderId,
      driverId,
      status,
      liveLocation,
      deliveredAt
    } = await request.json();

    const delivery = await prisma.delivery.create({
      data: {
        order: { connect: { id: parseInt(orderId) } },
        ...(driverId && { driver: { connect: { id: parseInt(driverId) } } }),
        status: status || 'ACCEPTED',
        liveLocation,
        ...(deliveredAt && { deliveredAt: new Date(deliveredAt) })
      },
      include: {
        order: {
          include: {
            customer: true,
            outlet: true,
            items: {
              include: {
                menuItem: true
              }
            }
          }
        },
        driver: true
      }
    });

    // Update order status if needed
    if (status === 'DELIVERED') {
      await prisma.order.update({
        where: { id: parseInt(orderId) },
        data: { status: 'COMPLETED' }
      });
    }

    return NextResponse.json(delivery, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Failed to create delivery' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      );
    }

    const data = await request.json();
    
    // Convert string IDs to numbers if they exist in the request
    if (data.orderId) data.orderId = parseInt(data.orderId);
    if (data.driverId) data.driverId = parseInt(data.driverId);
    
    // Convert string date to Date object if provided
    if (data.deliveredAt) data.deliveredAt = new Date(data.deliveredAt);

    const updatedDelivery = await prisma.delivery.update({
      where: { id: parseInt(id) },
      data,
      include: {
        order: {
          include: {
            customer: true,
            outlet: true,
            items: {
              include: {
                menuItem: true
              }
            }
          }
        },
        driver: true
      }
    });

    // Update order status if delivery status is DELIVERED
    if (data.status === 'DELIVERED') {
      await prisma.order.update({
        where: { id: updatedDelivery.orderId },
        data: { status: 'COMPLETED' }
      });
    }
    
    return NextResponse.json(updatedDelivery);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Failed to update delivery' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      );
    }

    await prisma.delivery.delete({
      where: { id: parseInt(id) },
    });
    
    return NextResponse.json({ message: 'Delivery deleted successfully' });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Failed to delete delivery' },
      { status: 500 }
    );
  }
}
