import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const outletId = searchParams.get('outletId');
    const cuisineId = searchParams.get('cuisineId');
    const menuName = searchParams.get('name');

    const menus = await prisma.menu.findMany({
      where: {
        ...(outletId && { outletId: parseInt(outletId) }),
        ...(cuisineId && { cuisineId: parseInt(cuisineId) }),
        ...(menuName && {
          name: {
            contains: menuName,
            mode: 'insensitive' // Case-insensitive search
          }
        })
      },
      include: {
        cuisine: true,
        outlet: true,
        _count: {
          select: { items: true },
        },
      },
    });

    return NextResponse.json(menus);
  } catch (error) {
    console.error('Error fetching menus:', error);
    return NextResponse.json(
      { error: 'Failed to fetch menus' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    
    // Validate required fields
    if (!data.name || !data.outletId) {
      return NextResponse.json(
        { error: 'Name and outletId are required' },
        { status: 400 }
      );
    }

    const menu = await prisma.menu.create({
      data: {
        name: data.name,
        description: data.description,
        outletId: parseInt(data.outletId),
        cuisineId: data.cuisineId ? parseInt(data.cuisineId) : null,
        isActive: data.isActive ?? true,
      },
    });

    return NextResponse.json(menu, { status: 201 });
  } catch (error) {
    console.error('Error creating menu:', error);
    return NextResponse.json(
      { error: 'Failed to create menu' },
      { status: 500 }
    );
  }
}
