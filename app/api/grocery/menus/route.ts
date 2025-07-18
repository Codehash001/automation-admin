import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const storeId = searchParams.get('storeId');
    const menuName = searchParams.get('name');

    const menus = await prisma.groceryMenu.findMany({
      where: {
        ...(storeId && { storeId: parseInt(storeId) }),
        ...(menuName && {
          name: {
            contains: menuName,
            mode: 'insensitive' // Case-insensitive search
          }
        })
      },
      include: {
        store: true,
        _count: {
          select: { items: true },
        },
      },
    });

    return NextResponse.json(menus);
  } catch (error) {
    console.error('Error fetching grocery menus:', error);
    return NextResponse.json(
      { error: 'Failed to fetch grocery menus' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    
    // Validate required fields
    if (!data.name || !data.storeId) {
      return NextResponse.json(
        { error: 'Name and storeId are required' },
        { status: 400 }
      );
    }

    const menu = await prisma.groceryMenu.create({
      data: {
        name: data.name,
        description: data.description,
        storeId: parseInt(data.storeId),
        isActive: data.isActive ?? true,
      },
    });

    return NextResponse.json(menu, { status: 201 });
  } catch (error) {
    console.error('Error creating grocery menu:', error);
    return NextResponse.json(
      { error: 'Failed to create grocery menu' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    
    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json(
        { error: 'Valid menu ID is required' },
        { status: 400 }
      );
    }
    
    const data = await req.json();
    
    // Check if menu exists
    const existingMenu = await prisma.groceryMenu.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingMenu) {
      return NextResponse.json(
        { error: 'Grocery menu not found' },
        { status: 404 }
      );
    }

    const updatedMenu = await prisma.groceryMenu.update({
      where: { id: parseInt(id) },
      data: {
        name: data.name,
        description: data.description,
        storeId: data.storeId ? parseInt(data.storeId) : undefined,
        isActive: data.isActive !== undefined ? data.isActive : undefined,
      },
      include: {
        store: true,
      }
    });

    return NextResponse.json(updatedMenu);
  } catch (error) {
    console.error('Error updating grocery menu:', error);
    return NextResponse.json(
      { error: 'Failed to update grocery menu' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    
    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json(
        { error: 'Valid menu ID is required' },
        { status: 400 }
      );
    }
    
    // Check if menu exists and has items
    const menu = await prisma.groceryMenu.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: { items: true }
        }
      }
    });
    
    if (!menu) {
      return NextResponse.json(
        { error: 'Grocery menu not found' },
        { status: 404 }
      );
    }
    
    // Prevent deletion if menu has items
    if (menu._count.items > 0) {
      return NextResponse.json(
        { 
          error: 'Cannot delete menu with associated items',
          itemsCount: menu._count.items
        },
        { status: 400 }
      );
    }
    
    await prisma.groceryMenu.delete({
      where: { id: parseInt(id) }
    });
    
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting grocery menu:', error);
    return NextResponse.json(
      { error: 'Failed to delete grocery menu' },
      { status: 500 }
    );
  }
}
