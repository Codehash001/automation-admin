import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const prices = await prisma.additionalPrice.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(prices);
  } catch (error) {
    console.error('Error fetching additional prices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch additional prices' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    // Validate required fields
    if (!data.name || data.value === undefined || !data.type) {
      return NextResponse.json(
        { error: 'Name, value, and type are required' },
        { status: 400 }
      );
    }

    const price = await prisma.additionalPrice.create({
      data: {
        name: data.name,
        value: parseFloat(data.value),
        type: data.type,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });

    return NextResponse.json(price, { status: 201 });
  } catch (error) {
    console.error('Error creating additional price:', error);
    return NextResponse.json(
      { error: 'Failed to create additional price' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const data = await request.json();
    
    if (!data.id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      );
    }

    const updatedPrice = await prisma.additionalPrice.update({
      where: { id: data.id },
      data: {
        name: data.name,
        value: data.value !== undefined ? parseFloat(data.value) : undefined,
        type: data.type,
        isActive: data.isActive,
      },
    });

    return NextResponse.json(updatedPrice);
  } catch (error) {
    console.error('Error updating additional price:', error);
    return NextResponse.json(
      { error: 'Failed to update additional price' },
      { status: 500 }
    );
  }
}

// Note: For DELETE method, you might want to use a dynamic route like [id]/route.ts
// But here's a basic implementation for the current route
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

    await prisma.additionalPrice.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json(
      { message: 'Additional price deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting additional price:', error);
    return NextResponse.json(
      { error: 'Failed to delete additional price' },
      { status: 500 }
    );
  }
}
