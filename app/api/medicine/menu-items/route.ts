import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: Fetch medicine menu items with optional filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const menuId = searchParams.get("menuId");
    const storeId = searchParams.get("storeId");
    
    // If ID is provided, fetch a specific menu item
    if (id) {
      const menuItem = await prisma.medicineMenuItem.findUnique({
        where: { id: parseInt(id) },
        include: {
          menu: {
            include: {
              store: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      if (!menuItem) {
        return NextResponse.json(
          { error: "Medicine menu item not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(menuItem);
    }

    // Otherwise, fetch all menu items with optional filters
    const where: any = {};
    
    if (menuId) {
      where.menuId = parseInt(menuId);
    }

    // If storeId is provided, filter by store
    if (storeId) {
      where.menu = {
        storeId: parseInt(storeId),
      };
    }

    const menuItems = await prisma.medicineMenuItem.findMany({
      where,
      include: {
        menu: {
          include: {
            store: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json(menuItems);
  } catch (error) {
    console.error("Error fetching medicine menu items:", error);
    return NextResponse.json(
      { error: "Failed to fetch medicine menu items" },
      { status: 500 }
    );
  }
}

// POST: Create a new medicine menu item
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, price, menuId, isActive } = body;

    // Validate required fields
    if (!name || !menuId || price === undefined) {
      return NextResponse.json(
        { error: "Name, menu ID, and price are required" },
        { status: 400 }
      );
    }

    // Validate price
    if (isNaN(price) || price < 0) {
      return NextResponse.json(
        { error: "Price must be a valid non-negative number" },
        { status: 400 }
      );
    }

    // Check if the menu exists
    const menu = await prisma.medicineMenu.findUnique({
      where: { id: menuId },
    });

    if (!menu) {
      return NextResponse.json(
        { error: "Medicine menu not found" },
        { status: 404 }
      );
    }

    // Create the menu item
    const menuItem = await prisma.medicineMenuItem.create({
      data: {
        name,
        description: description || null,
        price,
        menuId,
        isAvailable: isActive ?? true,
      },
      include: {
        menu: {
          include: {
            store: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(menuItem, { status: 201 });
  } catch (error) {
    console.error("Error creating medicine menu item:", error);
    return NextResponse.json(
      { error: "Failed to create medicine menu item" },
      { status: 500 }
    );
  }
}

// PUT: Update an existing medicine menu item
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Menu item ID is required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { name, description, price, menuId, isActive } = body;

    // Validate required fields
    if (!name || !menuId || price === undefined) {
      return NextResponse.json(
        { error: "Name, menu ID, and price are required" },
        { status: 400 }
      );
    }

    // Validate price
    if (isNaN(price) || price < 0) {
      return NextResponse.json(
        { error: "Price must be a valid non-negative number" },
        { status: 400 }
      );
    }

    // Check if the menu item exists
    const existingMenuItem = await prisma.medicineMenuItem.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingMenuItem) {
      return NextResponse.json(
        { error: "Medicine menu item not found" },
        { status: 404 }
      );
    }

    // Check if the menu exists
    if (menuId) {
      const menu = await prisma.medicineMenu.findUnique({
        where: { id: menuId },
      });

      if (!menu) {
        return NextResponse.json(
          { error: "Medicine menu not found" },
          { status: 404 }
        );
      }
    }

    // Update the menu item
    const updatedMenuItem = await prisma.medicineMenuItem.update({
      where: { id: parseInt(id) },
      data: {
        name,
        description: description || null,
        price,
        menuId,
        isAvailable: isActive ?? true,
      },
      include: {
        menu: {
          include: {
            store: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(updatedMenuItem);
  } catch (error) {
    console.error("Error updating medicine menu item:", error);
    return NextResponse.json(
      { error: "Failed to update medicine menu item" },
      { status: 500 }
    );
  }
}

// DELETE: Delete a medicine menu item
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Menu item ID is required" },
        { status: 400 }
      );
    }

    // Check if the menu item exists
    const menuItem = await prisma.medicineMenuItem.findUnique({
      where: { id: parseInt(id) },
    });

    if (!menuItem) {
      return NextResponse.json(
        { error: "Medicine menu item not found" },
        { status: 404 }
      );
    }

    // Delete the menu item
    await prisma.medicineMenuItem.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting medicine menu item:", error);
    return NextResponse.json(
      { error: "Failed to delete medicine menu item" },
      { status: 500 }
    );
  }
}
