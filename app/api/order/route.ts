import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendOrderNotificationToOutlet } from '@/lib/whatsapp';

export async function GET() {
  try {
    const orders = await prisma.order.findMany({
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            whatsappNumber: true,
          }
        },
        emirates: true,
        outlet: true,
        items: {
          include: {
            menuItem: true
          }
        },
        delivery: {
          include: {
            driver: true
          }
        },
        rating: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    return NextResponse.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const {
      customerId,
      emiratesId,
      orderType,
      category,
      outletId,
      deliveryAddress,
      deliveryLocation,
      buildingType,
      paymentMethod,
      note,
      status,
      subtotal,
      serviceFee,
      deliveryFee,
      vat,
      total,
      items
    } = await request.json();

    const order = await prisma.$transaction(async (prisma: { order: { create: (arg0: { data: { customer: { connect: { id: number; }; }; emirates: { connect: { id: number; }; }; orderType: any; category: any; outlet: { connect: { id: number; }; }; deliveryAddress: any; deliveryLocation: any; buildingType: any; paymentMethod: any; note: any; status: any; subtotal: number; serviceFee: number; deliveryFee: number; vat: number; total: number; }; }) => any; }; orderItem: { createMany: (arg0: { data: any; }) => any; }; }) => {
      // Create the order
      const newOrder = await prisma.order.create({
        data: {
          customer: { connect: { id: parseInt(customerId) } },
          emirates: { connect: { id: parseInt(emiratesId) } },
          orderType,
          category,
          outlet: { connect: { id: parseInt(outletId) } },
          deliveryAddress,
          deliveryLocation,
          buildingType,
          paymentMethod,
          note: note || '',
          status: status || 'PENDING',
          subtotal: parseFloat(subtotal),
          serviceFee: parseFloat(serviceFee),
          deliveryFee: parseFloat(deliveryFee),
          vat: parseFloat(vat),
          total: parseFloat(total),
        },
      });

      // Create order items
      if (items && items.length > 0) {
        await prisma.orderItem.createMany({
          data: items.map((item: { menuItemId: number; quantity: number; price: number }) => ({
            orderId: newOrder.id,
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            price: item.price,
          })),
        });
      }

      return newOrder;
    });

    // Send WhatsApp notification in the background (don't await to avoid blocking the response)
    sendOrderNotificationToOutlet(order.id)
      .then(success => {
        if (!success) {
          console.error('Failed to send WhatsApp notification');
        }
      })
      .catch(error => {
        console.error('Error sending WhatsApp notification:', error);
      });

    // Fetch the complete order with relationships
    const createdOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: {
        customer: true,
        emirates: true,
        outlet: true,
        items: {
          include: {
            menuItem: true
          }
        }
      }
    });

    return NextResponse.json(createdOrder, { status: 201 });
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json(
      { error: 'Failed to create order' },
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
    if (data.customerId) data.customerId = parseInt(data.customerId);
    if (data.emiratesId) data.emiratesId = parseInt(data.emiratesId);
    if (data.orderTypeId) data.orderTypeId = parseInt(data.orderTypeId);
    if (data.outletId) data.outletId = parseInt(data.outletId);
    
    // Convert string numbers to floats for decimal fields
    if (data.subtotal) data.subtotal = parseFloat(data.subtotal);
    if (data.serviceFee) data.serviceFee = parseFloat(data.serviceFee);
    if (data.deliveryFee) data.deliveryFee = parseFloat(data.deliveryFee);
    if (data.vat) data.vat = parseFloat(data.vat);
    if (data.total) data.total = parseFloat(data.total);

    const updatedOrder = await prisma.order.update({
      where: { id: parseInt(id) },
      data,
      include: {
        customer: true,
        emirates: true,
        outlet: true,
        items: {
          include: {
            menuItem: true
          }
        },
        delivery: {
          include: {
            driver: true
          }
        },
        rating: true
      }
    });
    
    return NextResponse.json(updatedOrder);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Failed to update order' },
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

    // First delete related records
    await prisma.orderItem.deleteMany({
      where: { orderId: parseInt(id) }
    });

    await prisma.rating.deleteMany({
      where: { orderId: parseInt(id) }
    });

    await prisma.delivery.deleteMany({
      where: { orderId: parseInt(id) }
    });

    // Then delete the order
    await prisma.order.delete({
      where: { id: parseInt(id) },
    });
    
    return NextResponse.json({ message: 'Order and related data deleted successfully' });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Failed to delete order' },
      { status: 500 }
    );
  }
}
