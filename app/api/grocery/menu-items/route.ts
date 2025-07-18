import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const menuId = searchParams.get('menuId');
    const storeId = searchParams.get('storeId');
    const name = searchParams.get('name');

    const menuItems = await prisma.groceryMenuItem.findMany({
      where: {
        ...(menuId && { menuId: parseInt(menuId) }),
        ...(name && {
          name: {
            contains: name,
            mode: 'insensitive'
          }
        }),
        menu: {
          ...(storeId && { storeId: parseInt(storeId) })
        }
      },
      include: {
        menu: {
          include: {
            store: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    return NextResponse.json(menuItems);
  } catch (error) {
    console.error('Error fetching grocery menu items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch grocery menu items' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    
    // Validate required fields
    if (!data.name || !data.menuId || !data.price) {
      return NextResponse.json(
        { error: 'Name, menuId, and price are required' },
        { status: 400 }
      );
    }

    // Validate price is a positive number
    if (typeof data.price !== 'number' || data.price <= 0) {
      return NextResponse.json(
        { error: 'Price must be a positive number' },
        { status: 400 }
      );
    }

    // Check if menu exists
    const menu = await prisma.groceryMenu.findUnique({
      where: { id: parseInt(data.menuId) }
    });

    if (!menu) {
      return NextResponse.json(
        { error: 'Grocery menu not found' },
        { status: 404 }
      );
    }

    const menuItem = await prisma.groceryMenuItem.create({
      data: {
        name: data.name,
        description: data.description || '',
        price: data.price,
        menuId: parseInt(data.menuId),
        imageUrl: data.imageUrl || '',
        isAvailable: data.isActive ?? true,
      },
      include: {
        menu: {
          include: {
            store: true
          }
        }
      }
    });

    return NextResponse.json(menuItem, { status: 201 });
  } catch (error) {
    console.error('Error creating grocery menu item:', error);
    return NextResponse.json(
      { error: 'Failed to create grocery menu item' },
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
        { error: 'Valid menu item ID is required' },
        { status: 400 }
      );
    }
    
    const data = await req.json();
    
    // Check if menu item exists
    const existingMenuItem = await prisma.groceryMenuItem.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingMenuItem) {
      return NextResponse.json(
        { error: 'Grocery menu item not found' },
        { status: 404 }
      );
    }

    // If menuId is provided, check if the menu exists
    if (data.menuId) {
      const menu = await prisma.groceryMenu.findUnique({
        where: { id: parseInt(data.menuId) }
      });

      if (!menu) {
        return NextResponse.json(
          { error: 'Grocery menu not found' },
          { status: 404 }
        );
      }
    }

    // Validate price if provided
    if (data.price !== undefined && (typeof data.price !== 'number' || data.price <= 0)) {
      return NextResponse.json(
        { error: 'Price must be a positive number' },
        { status: 400 }
      );
    }

    const updatedMenuItem = await prisma.groceryMenuItem.update({
      where: { id: parseInt(id) },
      data: {
        name: data.name,
        description: data.description,
        price: data.price,
        menuId: data.menuId ? parseInt(data.menuId) : undefined,
        imageUrl: data.imageUrl,
        isAvailable: data.isActive,
      },
      include: {
        menu: {
          include: {
            store: true
          }
        }
      }
    });

    return NextResponse.json(updatedMenuItem);
  } catch (error) {
    console.error('Error updating grocery menu item:', error);
    return NextResponse.json(
      { error: 'Failed to update grocery menu item' },
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
        { error: 'Valid menu item ID is required' },
        { status: 400 }
      );
    }
    
    // Check if menu item exists
    const menuItem = await prisma.groceryMenuItem.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!menuItem) {
      return NextResponse.json(
        { error: 'Grocery menu item not found' },
        { status: 404 }
      );
    }
    
    // Check if the menu item is referenced in any orders
    const orderItemsCount = await prisma.groceryOrderItem.count({
      where: { groceryMenuItemId: parseInt(id) }
    });
    
    if (orderItemsCount > 0) {
      return NextResponse.json(
        { 
          error: 'Cannot delete menu item that is referenced in orders',
          orderItemsCount
        },
        { status: 400 }
      );
    }
    
    await prisma.groceryMenuItem.delete({
      where: { id: parseInt(id) }
    });
    
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting grocery menu item:', error);
    return NextResponse.json(
      { error: 'Failed to delete grocery menu item' },
      { status: 500 }
    );
  }
}
