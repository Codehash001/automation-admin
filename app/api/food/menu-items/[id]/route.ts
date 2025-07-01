import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const menuItem = await prisma.menuItem.findUnique({
      where: { id: parseInt(params.id) },
      include: {
        menu: {
          include: {
            cuisine: true,
            outlet: true,
          },
        },
      },
    });

    if (!menuItem) {
      return NextResponse.json(
        { error: 'Menu item not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(menuItem);
  } catch (error) {
    console.error('Error fetching menu item:', error);
    return NextResponse.json(
      { error: 'Failed to fetch menu item' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const data = await req.json();
    
    // Check if menu item exists
    const existingItem = await prisma.menuItem.findUnique({
      where: { id: parseInt(params.id) },
    });

    if (!existingItem) {
      return NextResponse.json(
        { error: 'Menu item not found' },
        { status: 404 }
      );
    }


    const updatedItem = await prisma.menuItem.update({
      where: { id: parseInt(params.id) },
      data: {
        name: data.name ?? existingItem.name,
        description: data.description ?? existingItem.description,
        price: data.price ? parseFloat(data.price) : existingItem.price,
        imageUrl: data.imageUrl ?? existingItem.imageUrl,
        isAvailable: data.isAvailable ?? existingItem.isAvailable,
        ...(data.menuId && { menuId: parseInt(data.menuId) }),
      },
    });

    return NextResponse.json(updatedItem);
  } catch (error) {
    console.error('Error updating menu item:', error);
    return NextResponse.json(
      { error: 'Failed to update menu item' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check if menu item exists
    const existingItem = await prisma.menuItem.findUnique({
      where: { id: parseInt(params.id) },
      include: { _count: { select: { orderItems: true } } },
    });

    if (!existingItem) {
      return NextResponse.json(
        { error: 'Menu item not found' },
        { status: 404 }
      );
    }

    // Prevent deletion if item is in any orders
    if (existingItem._count.orderItems > 0) {
      return NextResponse.json(
        { error: 'Cannot delete menu item that is part of existing orders' },
        { status: 400 }
      );
    }

    await prisma.menuItem.delete({
      where: { id: parseInt(params.id) },
    });

    return NextResponse.json(
      { message: 'Menu item deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting menu item:', error);
    return NextResponse.json(
      { error: 'Failed to delete menu item' },
      { status: 500 }
    );
  }
}
