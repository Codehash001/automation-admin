import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

type OutletData = {
  name: string;
  emiratesId: number;
  cuisineIds: number[];
  whatsappNo: string;
  status: 'OPEN' | 'BUSY' | 'CLOSED';
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const emirateId = searchParams.get('emirateId');
    const cuisineId = searchParams.get('cuisineId');
    const responseType = searchParams.get('responseType');
    const outletName = searchParams.get('name');

    // Get outlet ID by name
    if (outletName) {
      const outlet = await prisma.outlet.findFirst({
        where: { 
          name: {
            equals: outletName,
            mode: 'insensitive' // Case-insensitive search
          }
        },
        select: {
          id: true
        }
      });

      if (!outlet) {
        return NextResponse.json(
          { error: 'Outlet not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ id: outlet.id });
    }

    if (id) {
      // Get single outlet with relationships
      const outlet = await prisma.outlet.findUnique({
        where: { id: parseInt(id) },
        include: {
          emirates: true,
          cuisines: {
            include: {
              cuisine: true
            }
          },
          _count: {
            select: {
              menus: true,
              orders: true
            }
          }
        }
      });

      if (!outlet) {
        return NextResponse.json(
          { error: 'Outlet not found' },
          { status: 404 }
        );
      }

      // Format the response
      const formattedOutlet = {
        ...outlet,
        cuisines: outlet.cuisines.map(oc => ({
          cuisine: oc.cuisine
        }))
      };

      return NextResponse.json(formattedOutlet);
    }

    // Build the where clause based on filters
    const where: any = {};
    
    if (emirateId) {
      where.emiratesId = parseInt(emirateId);
    }
    
    if (cuisineId) {
      where.cuisines = {
        some: {
          cuisineId: parseInt(cuisineId)
        }
      };
    }

    // Get all outlets with relationships
    const outlets = await prisma.outlet.findMany({
      where,
      include: {
        emirates: true,
        cuisines: {
          include: {
            cuisine: true
          }
        },
        _count: {
          select: {
            menus: true,
            orders: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    // Check if responseType is objectArray
    if (responseType === 'objectArray') {
      // Format as object array
      const outletsObject: { [key: string]: any } = {};
      outlets.forEach((outlet, index) => {
        outletsObject[`outlet${index + 1}`] = {
          ...outlet,
          cuisines: outlet.cuisines.map(oc => ({
            cuisine: oc.cuisine
          }))
        };
      });
      return NextResponse.json({ outlets: outletsObject });
    }

    // Default response format (array)
    const formattedOutlets = outlets.map(outlet => ({
      ...outlet,
      cuisines: outlet.cuisines.map(oc => ({
        cuisine: oc.cuisine
      }))
    }));

    return NextResponse.json(formattedOutlets);
  } catch (error) {
    console.error('Error fetching outlets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch outlets' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const data: OutletData = await request.json();
    
    // Validate required fields
    if (!data.name || !data.emiratesId || !data.cuisineIds || !data.whatsappNo) {
      return NextResponse.json(
        { error: 'Name, emirate, cuisines, and WhatsApp number are required' },
        { status: 400 }
      );
    }

    // Check if emirate exists
    const emirate = await prisma.emirates.findUnique({
      where: { id: data.emiratesId }
    });

    if (!emirate) {
      return NextResponse.json(
        { error: 'Selected emirate does not exist' },
        { status: 400 }
      );
    }

    // Check if all cuisines exist
    const cuisines = await prisma.cuisine.findMany({
      where: {
        id: { in: data.cuisineIds }
      }
    });

    if (cuisines.length !== data.cuisineIds.length) {
      return NextResponse.json(
        { error: 'One or more selected cuisines do not exist' },
        { status: 400 }
      );
    }

    // Check if outlet with same name already exists in the same emirate
    const existingOutlet = await prisma.outlet.findFirst({
      where: {
        name: data.name.trim(),
        emiratesId: data.emiratesId
      }
    });

    if (existingOutlet) {
      return NextResponse.json(
        { error: 'An outlet with this name already exists in the selected emirate' },
        { status: 409 }
      );
    }

    // Create the outlet with its relationships
    const outlet = await prisma.$transaction(async (prisma) => {
      const newOutlet = await prisma.outlet.create({
        data: {
          name: data.name.trim(),
          emiratesId: data.emiratesId,
          whatsappNo: data.whatsappNo.trim(),
          status: data.status || 'OPEN',
          cuisines: {
            create: data.cuisineIds.map(cuisineId => ({
              cuisine: { connect: { id: cuisineId } }
            }))
          }
        },
        include: {
          emirates: true,
          cuisines: {
            include: {
              cuisine: true
            }
          }
        }
      });

      return newOutlet;
    });

    // Format the response
    const formattedOutlet = {
      ...outlet,
      cuisines: outlet.cuisines.map(oc => ({
        cuisine: oc.cuisine
      }))
    };

    return NextResponse.json(formattedOutlet, { status: 201 });
  } catch (error) {
    console.error('Error creating outlet:', error);
    return NextResponse.json(
      { error: 'Failed to create outlet' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json(
        { error: 'Valid outlet ID is required' },
        { status: 400 }
      );
    }

    const data: Partial<OutletData> = await request.json();
    
    // Check if outlet exists
    const existingOutlet = await prisma.outlet.findUnique({
      where: { id: parseInt(id) },
      include: {
        cuisines: true
      }
    });

    if (!existingOutlet) {
      return NextResponse.json(
        { error: 'Outlet not found' },
        { status: 404 }
      );
    }

    // Check if emirate exists if being updated
    if (data.emiratesId) {
      const emirate = await prisma.emirates.findUnique({
        where: { id: data.emiratesId }
      });

      if (!emirate) {
        return NextResponse.json(
          { error: 'Selected emirate does not exist' },
          { status: 400 }
        );
      }
    }

    // Check if all cuisines exist if being updated
    if (data.cuisineIds) {
      const cuisines = await prisma.cuisine.findMany({
        where: {
          id: { in: data.cuisineIds }
        }
      });

      if (cuisines.length !== data.cuisineIds.length) {
        return NextResponse.json(
          { error: 'One or more selected cuisines do not exist' },
          { status: 400 }
        );
      }
    }

    // Check for duplicate name in the same emirate
    if (data.name && data.name.trim() !== existingOutlet.name) {
      const nameInUse = await prisma.outlet.findFirst({
        where: {
          name: data.name.trim(),
          emiratesId: data.emiratesId || existingOutlet.emiratesId,
          id: { not: parseInt(id) }
        }
      });

      if (nameInUse) {
        return NextResponse.json(
          { error: 'An outlet with this name already exists in the selected emirate' },
          { status: 409 }
        );
      }
    }

    // Update the outlet with its relationships
    const updatedOutlet = await prisma.$transaction(async (prisma) => {
      // Update the outlet
      await prisma.outlet.update({
        where: { id: parseInt(id) },
        data: {
          name: data.name?.trim(),
          emiratesId: data.emiratesId,
          whatsappNo: data.whatsappNo?.trim(),
          status: data.status,
        },
      });

      // If cuisines are being updated, update the join table
      if (data.cuisineIds) {
        // Delete all existing cuisine connections
        await prisma.outletCuisine.deleteMany({
          where: { outletId: parseInt(id) }
        });

        // Create new connections
        await prisma.outletCuisine.createMany({
          data: data.cuisineIds.map(cuisineId => ({
            outletId: parseInt(id),
            cuisineId: cuisineId,
            assignedAt: new Date()
          })),
          skipDuplicates: true,
        });
      }

      // Fetch the updated outlet with all relationships
      return await prisma.outlet.findUnique({
        where: { id: parseInt(id) },
        include: {
          emirates: true,
          cuisines: {
            include: {
              cuisine: true
            }
          },
          _count: {
            select: {
              menus: true,
              orders: true
            }
          }
        }
      });
    });

    // Format the response
    const formattedOutlet = {
      ...updatedOutlet,
      cuisines: updatedOutlet?.cuisines.map(oc => ({
        cuisine: oc.cuisine
      })) || []
    };

    return NextResponse.json(formattedOutlet);
  } catch (error) {
    console.error('Error updating outlet:', error);
    return NextResponse.json(
      { error: 'Failed to update outlet' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json(
        { error: 'Valid outlet ID is required' },
        { status: 400 }
      );
    }

    // Check if outlet exists and get related counts
    const outlet = await prisma.outlet.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: {
            menus: true,
            orders: true
          }
        }
      }
    });

    if (!outlet) {
      return NextResponse.json(
        { error: 'Outlet not found' },
        { status: 404 }
      );
    }

    // Prevent deletion if there are associated menus or orders
    if (outlet._count.menus > 0 || outlet._count.orders > 0) {
      return NextResponse.json(
        { 
          error: 'Cannot delete outlet with associated menus or orders',
          hasMenus: outlet._count.menus > 0,
          hasOrders: outlet._count.orders > 0
        },
        { status: 400 }
      );
    }

    // Delete the outlet (this will cascade to OutletCuisine due to Prisma's referential actions)
    await prisma.outlet.delete({
      where: { id: parseInt(id) }
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting outlet:', error);
    return NextResponse.json(
      { error: 'Failed to delete outlet' },
      { status: 500 }
    );
  }
}