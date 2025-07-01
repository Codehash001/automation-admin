import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const orderTypes = await prisma.orderType.findMany({
      include: {
        orders: true
      }
    });
    return NextResponse.json(orderTypes);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch order types' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { name } = await request.json();
    const orderType = await prisma.orderType.create({
      data: { name },
    });
    return NextResponse.json(orderType, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create order type' },
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

    const { name } = await request.json();
    const updatedOrderType = await prisma.orderType.update({
      where: { id: parseInt(id) },
      data: { name },
    });
    
    return NextResponse.json(updatedOrderType);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update order type' },
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

    await prisma.orderType.delete({
      where: { id: parseInt(id) },
    });
    
    return NextResponse.json({ message: 'Order type deleted successfully' });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete order type' },
      { status: 500 }
    );
  }
}
