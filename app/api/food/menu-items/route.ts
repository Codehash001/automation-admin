import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const menuId = searchParams.get('menuId');
    const isAvailable = searchParams.get('isAvailable');

    const menuItems = await prisma.menuItem.findMany({
      where: {
        ...(menuId && { menuId: parseInt(menuId) }),
        ...(isAvailable && { isAvailable: isAvailable === 'true' }),
      },
      include: {
        menu: {
          include: {
            cuisine: {
              select: { name: true },
            },
            outlet: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(menuItems);
  } catch (error) {
    console.error('Error fetching menu items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch menu items' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    // Validate required fields
    if (!data.name || !data.price || !data.menuId) {
      return NextResponse.json(
        { error: 'Name, price, and menuId are required' },
        { status: 400 }
      );
    }

    // Check if menu exists
    const menu = await prisma.menu.findUnique({
      where: { id: parseInt(data.menuId) },
    });

    if (!menu) {
      return NextResponse.json(
        { error: 'Menu not found' },
        { status: 404 }
      );
    }


    const menuItem = await prisma.menuItem.create({
      data: {
        name: data.name,
        description: data.description,
        price: parseFloat(data.price),
        imageUrl: data.imageUrl,
        isAvailable: data.isAvailable ?? true,
        menuId: parseInt(data.menuId),
      },
    });

    return NextResponse.json(menuItem, { status: 201 });
  } catch (error) {
    console.error('Error creating menu item:', error);
    return NextResponse.json(
      { error: 'Failed to create menu item' },
      { status: 500 }
    );
  }
}
