import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: Fetch medicine menus with optional filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const storeId = searchParams.get("storeId");
    
    // If ID is provided, fetch a specific menu
    if (id) {
      const menu = await prisma.medicineMenu.findUnique({
        where: { id: parseInt(id) },
        include: {
          store: true,
          _count: {
            select: {
              items: true,
            },
          },
        },
      });

      if (!menu) {
        return NextResponse.json(
          { error: "Medicine menu not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(menu);
    }

    // Otherwise, fetch all menus with optional filters
    const where: any = {};
    
    if (storeId) {
      where.storeId = parseInt(storeId);
    }

    const menus = await prisma.medicineMenu.findMany({
      where,
      include: {
        store: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            items: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json(menus);
  } catch (error) {
    console.error("Error fetching medicine menus:", error);
    return NextResponse.json(
      { error: "Failed to fetch medicine menus" },
      { status: 500 }
    );
  }
}

// POST: Create a new medicine menu
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, storeId, isActive } = body;

    // Validate required fields
    if (!name || !storeId) {
      return NextResponse.json(
        { error: "Name and store ID are required" },
        { status: 400 }
      );
    }

    // Check if the store exists
    const store = await prisma.medicalStore.findUnique({
      where: { id: storeId },
    });

    if (!store) {
      return NextResponse.json(
        { error: "Medical store not found" },
        { status: 404 }
      );
    }

    // Create the menu
    const menu = await prisma.medicineMenu.create({
      data: {
        name,
        description: description || null,
        storeId,
        isActive: isActive ?? true,
      },
      include: {
        store: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(menu, { status: 201 });
  } catch (error) {
    console.error("Error creating medicine menu:", error);
    return NextResponse.json(
      { error: "Failed to create medicine menu" },
      { status: 500 }
    );
  }
}

// PUT: Update an existing medicine menu
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Menu ID is required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { name, description, storeId, isActive } = body;

    // Validate required fields
    if (!name || !storeId) {
      return NextResponse.json(
        { error: "Name and store ID are required" },
        { status: 400 }
      );
    }

    // Check if the menu exists
    const existingMenu = await prisma.medicineMenu.findUnique({
      where: { id: parseInt(id) },
      include: {
        items: {
          select: { id: true },
        },
      },
    });

    if (!existingMenu) {
      return NextResponse.json(
        { error: "Medicine menu not found" },
        { status: 404 }
      );
    }

    // Check if the store exists
    if (storeId) {
      const store = await prisma.medicalStore.findUnique({
        where: { id: storeId },
      });

      if (!store) {
        return NextResponse.json(
          { error: "Medical store not found" },
          { status: 404 }
        );
      }
    }

    // Update the menu
    const updatedMenu = await prisma.medicineMenu.update({
      where: { id: parseInt(id) },
      data: {
        name,
        description: description || null,
        storeId,
        isActive: isActive ?? true,
      },
      include: {
        store: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(updatedMenu);
  } catch (error) {
    console.error("Error updating medicine menu:", error);
    return NextResponse.json(
      { error: "Failed to update medicine menu" },
      { status: 500 }
    );
  }
}

// DELETE: Delete a medicine menu
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Menu ID is required" },
        { status: 400 }
      );
    }

    // Check if the menu exists and has items
    const menu = await prisma.medicineMenu.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: {
            items: true,
          },
        },
      },
    });

    if (!menu) {
      return NextResponse.json(
        { error: "Medicine menu not found" },
        { status: 404 }
      );
    }

    // Don't allow deletion if the menu has items
    if (menu._count.items > 0) {
      return NextResponse.json(
        { error: "Cannot delete menu with items. Remove all items first." },
        { status: 400 }
      );
    }

    // Delete the menu
    await prisma.medicineMenu.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting medicine menu:", error);
    return NextResponse.json(
      { error: "Failed to delete medicine menu" },
      { status: 500 }
    );
  }
}
