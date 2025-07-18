import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Driver, DriverType } from '@prisma/client';

interface RiderWithRelations extends Driver {
  emirates: {
    emirate: {
      id: number;
      name: string;
    };
  }[];
  _count: {
    deliveries: number;
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    // Handle single rider by ID
    if (id) {
      const rider = await prisma.driver.findUnique({
        where: { id: Number(id) },
        include: {
          emirates: {
            include: {
              emirate: true,
            },
          },
        },
      });

      if (!rider) {
        return NextResponse.json(
          { error: 'Rider not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(rider);
    }

    // Handle list of riders with filters
    try {
      const emirateId = searchParams.get('emirateId');
      const driverType = searchParams.get('driverType') as DriverType | null;
      const available = searchParams.get('available');
      
      const where: any = {};
      
      // Only filter by available if explicitly requested
      if (available !== null) {
        where.available = available === 'true';
      }
      
      if (emirateId) {
        where.emirates = {
          some: { emirateId: Number(emirateId) }
        };
      }
      
      if (driverType) {
        where.driverType = driverType;
      }

      const riders = await prisma.driver.findMany({
        where,
        select: {
          id: true,
          name: true,
          phone: true,
          available: true,
          driverType: true,
          emirates: {
            include: {
              emirate: true,
            },
          },
          _count: {
            select: {
              deliveries: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      });

      // Format the response
      const responseData = riders.map((rider: any) => ({
        ...rider,
        emirates: rider.emirates.map((e: any) => ({
          emirate: e.emirate
        }))
      }));

      return NextResponse.json(responseData);
      
    } catch (error) {
      console.error('Error fetching riders:', error);
      return NextResponse.json(
        { error: 'Failed to fetch riders' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in /api/riders:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { name, phone, emirateIds, available = true, driverType = 'DELIVERY' } = await request.json();

    // Validate input
    if (!name || !phone) {
      return NextResponse.json(
        { error: 'Name and phone are required' },
        { status: 400 }
      );
    }

    // Validate driverType
    if (!['DELIVERY', 'RIDE_SERVICE'].includes(driverType)) {
      return NextResponse.json(
        { error: 'Invalid driver type' },
        { status: 400 }
      );
    }

    // Check if rider with this phone already exists
    const existingRider = await prisma.driver.findUnique({
      where: { phone },
    });

    if (existingRider) {
      return NextResponse.json(
        { error: 'A rider with this phone number already exists' },
        { status: 400 }
      );
    }

    const rider = await prisma.driver.create({
      data: {
        name,
        phone,
        available,
        driverType: driverType as DriverType,
        emirates: emirateIds?.length > 0 ? {
          create: emirateIds.map((id: number) => ({
            emirate: {
              connect: { id: Number(id) },
            },
          })),
        } : undefined,
      },
      include: {
        emirates: {
          include: {
            emirate: true,
          },
        },
      },
    });

    return NextResponse.json(rider, { status: 201 });
  } catch (error) {
    console.error('Error creating rider:', error);
    return NextResponse.json(
      { error: 'Failed to create rider' },
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
        { error: 'Rider ID is required' },
        { status: 400 }
      );
    }

    const { name, phone, emirateIds, available, driverType } = await request.json();

    // Check if rider exists
    const existingRider = await prisma.driver.findUnique({
      where: { id: Number(id) },
    });

    if (!existingRider) {
      return NextResponse.json(
        { error: 'Rider not found' },
        { status: 404 }
      );
    }

    // Validate driverType if provided
    if (driverType && !['DELIVERY', 'RIDE_SERVICE'].includes(driverType)) {
      return NextResponse.json(
        { error: 'Invalid driver type' },
        { status: 400 }
      );
    }

    // Check if phone is being updated to a number that already exists
    if (phone && phone !== existingRider.phone) {
      const phoneExists = await prisma.driver.findFirst({
        where: {
          phone,
          id: { not: Number(id) },
        },
      });

      if (phoneExists) {
        return NextResponse.json(
          { error: 'A rider with this phone number already exists' },
          { status: 400 }
        );
      }
    }

    // Update rider
    const updatedRider = await prisma.driver.update({
      where: { id: Number(id) },
      data: {
        name,
        phone,
        available,
        ...(driverType && { driverType: driverType as DriverType }),
        ...(emirateIds && {
          emirates: {
            deleteMany: {}, // Remove all existing emirate connections
            create: emirateIds.map((id: number) => ({
              emirate: {
                connect: { id: Number(id) },
              },
            })),
          },
        }),
      },
      include: {
        emirates: {
          include: {
            emirate: true,
          },
        },
      },
    });

    return NextResponse.json(updatedRider);
  } catch (error) {
    console.error('Error updating rider:', error);
    return NextResponse.json(
      { error: 'Failed to update rider' },
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
        { error: 'Rider ID is required' },
        { status: 400 }
      );
    }

    // Check if rider has any deliveries
    const deliveries = await prisma.delivery.count({
      where: { driverId: Number(id) },
    });

    if (deliveries > 0) {
      return NextResponse.json(
        { error: 'Cannot delete rider with existing deliveries' },
        { status: 400 }
      );
    }

    // Delete rider
    await prisma.driverEmirate.deleteMany({
      where: { driverId: Number(id) },
    });

    await prisma.driver.delete({
      where: { id: Number(id) },
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting rider:', error);
    return NextResponse.json(
      { error: 'Failed to delete rider' },
      { status: 500 }
    );
  }
}
