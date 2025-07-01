import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const menu = await prisma.menu.findUnique({
      where: { id: parseInt(params.id) },
      include: {
        cuisine: true,
        outlet: true,
        items: true,
      },
    });

    if (!menu) {
      return NextResponse.json(
        { error: 'Menu not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(menu);
  } catch (error) {
    console.error('Error fetching menu:', error);
    return NextResponse.json(
      { error: 'Failed to fetch menu' },
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
    
    // Check if menu exists
    const existingMenu = await prisma.menu.findUnique({
      where: { id: parseInt(params.id) },
    });

    if (!existingMenu) {
      return NextResponse.json(
        { error: 'Menu not found' },
        { status: 404 }
      );
    }

    const updatedMenu = await prisma.menu.update({
      where: { id: parseInt(params.id) },
      data: {
        name: data.name ?? existingMenu.name,
        description: data.description ?? existingMenu.description,
        cuisineId: data.cuisineId ? parseInt(data.cuisineId) : existingMenu.cuisineId,
        isActive: data.isActive ?? existingMenu.isActive,
      },
    });

    return NextResponse.json(updatedMenu);
  } catch (error) {
    console.error('Error updating menu:', error);
    return NextResponse.json(
      { error: 'Failed to update menu' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check if menu exists
    const existingMenu = await prisma.menu.findUnique({
      where: { id: parseInt(params.id) },
      include: { _count: { select: { items: true } } },
    });

    if (!existingMenu) {
      return NextResponse.json(
        { error: 'Menu not found' },
        { status: 404 }
      );
    }

    // Prevent deletion if menu has items
    if (existingMenu._count.items > 0) {
      return NextResponse.json(
        { error: 'Cannot delete menu with existing items' },
        { status: 400 }
      );
    }

    await prisma.menu.delete({
      where: { id: parseInt(params.id) },
    });

    return NextResponse.json(
      { message: 'Menu deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting menu:', error);
    return NextResponse.json(
      { error: 'Failed to delete menu' },
      { status: 500 }
    );
  }
}
