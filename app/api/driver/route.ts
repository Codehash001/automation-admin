import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const drivers = await prisma.driver.findMany({
      include: {
        deliveries: {
          include: {
            order: true
          }
        }
      }
    });
    return NextResponse.json(drivers);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch drivers' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { name, phone, available = true } = await request.json();
    
    const driver = await prisma.driver.create({
      data: {
        name,
        phone,
        available,
      },
    });
    
    return NextResponse.json(driver, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Failed to create driver' },
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
    
    const updatedDriver = await prisma.driver.update({
      where: { id: parseInt(id) },
      data,
      include: {
        deliveries: {
          include: {
            order: true
          }
        }
      }
    });
    
    return NextResponse.json(updatedDriver);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Failed to update driver' },
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

    // First update any deliveries to remove the driver reference
    await prisma.delivery.updateMany({
      where: { driverId: parseInt(id) },
      data: { driverId: null },
    });

    // Then delete the driver
    await prisma.driver.delete({
      where: { id: parseInt(id) },
    });
    
    return NextResponse.json({ message: 'Driver deleted successfully' });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Failed to delete driver' },
      { status: 500 }
    );
  }
}
