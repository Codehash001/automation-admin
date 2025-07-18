import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

type CuisineData = {
  name: string;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const name = searchParams.get('name');

    if (id) {
      const cuisine = await prisma.cuisine.findUnique({
        where: { id: parseInt(id) },
        select: {
          id: true,
          name: true,
          outlets: {
            select: {
              outlet: {
                select: { 
                  id: true, 
                  name: true 
                }
              },
              outletId: true,
              cuisineId: true,
              assignedAt: true
            }
          }
        },
      });
      
      if (!cuisine) {
        return NextResponse.json(
          { error: 'Cuisine not found' },
          { status: 404 }
        );
      }
      
      // Format the response to include the count
      const formattedCuisine = {
        ...cuisine,
        _count: {
          outlets: cuisine.outlets.length
        }
      };
      
      return NextResponse.json(formattedCuisine);
    }

    // Get cuisine by name if name parameter is provided
    if (name) {
      const cuisine = await prisma.cuisine.findFirst({
        where: { 
          name: { 
            equals: name,
            mode: 'insensitive' // Case-insensitive search
          } 
        },
        select: {
          id: true,
          name: true,
          outlets: {
            select: {
              outlet: {
                select: { 
                  id: true, 
                  name: true 
                }
              },
              outletId: true,
              cuisineId: true,
              assignedAt: true
            }
          }
        }
      });

      if (!cuisine) {
        return NextResponse.json(
          { error: `Cuisine with name "${name}" not found` },
          { status: 404 }
        );
      }


      // Format the response to include the count
      const formattedCuisine = {
        ...cuisine,
        _count: {
          outlets: cuisine.outlets.length
        }
      };
      
      return NextResponse.json(formattedCuisine);
    }

    // Get all cuisines
    const cuisines = await prisma.cuisine.findMany({
      orderBy: { name: 'asc' }
    });

    // Get counts using raw SQL with proper typing
    type CountResult = Array<{ cuisineId: number; count: bigint }>;
    const counts = await prisma.$queryRaw<CountResult>`
      SELECT "cuisineId", COUNT(*) as count
      FROM "OutletCuisine"
      GROUP BY "cuisineId"
    `;

    // Convert to a map for easier lookup
    const countsMap = new Map(
      counts.map((item: any) => [item.cuisineId, Number(item.count)])
    );

    // Merge counts with cuisines and ensure dates are serialized
    const cuisinesWithCounts = cuisines.map((cuisine: any) => ({
      ...cuisine,
      _count: {
        outlets: countsMap.get(cuisine.id) || 0
      }
    }));
    
    return NextResponse.json(cuisinesWithCounts);
  } catch (error) {
    console.error('Error fetching cuisines:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cuisines' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const data: CuisineData = await request.json();
    
    if (!data.name || typeof data.name !== 'string') {
      return NextResponse.json(
        { error: 'Name is required and must be a string' },
        { status: 400 }
      );
    }
    
    const existingCuisine = await prisma.cuisine.findUnique({
      where: { name: data.name.trim() },
    });

    if (existingCuisine) {
      return NextResponse.json(
        { error: 'A cuisine with this name already exists' },
        { status: 409 }
      );
    }

    const cuisine = await prisma.cuisine.create({
      data: {
        name: data.name.trim(),
      },
    });

    return NextResponse.json(cuisine, { status: 201 });
  } catch (error) {
    console.error('Error creating cuisine:', error);
    return NextResponse.json(
      { error: 'Failed to create cuisine' },
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
        { error: 'Valid cuisine ID is required' },
        { status: 400 }
      );
    }

    const data: Partial<CuisineData> = await request.json();
    
    if (!data.name || typeof data.name !== 'string') {
      return NextResponse.json(
        { error: 'Name is required and must be a string' },
        { status: 400 }
      );
    }
    
    const existingCuisine = await prisma.cuisine.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingCuisine) {
      return NextResponse.json(
        { error: 'Cuisine not found' },
        { status: 404 }
      );
    }

    // Check if name is being changed and if the new name already exists
    if (data.name.trim() !== existingCuisine.name) {
      const nameExists = await prisma.cuisine.findFirst({
        where: {
          name: data.name.trim(),
          id: { not: parseInt(id) },
        },
      });

      if (nameExists) {
        return NextResponse.json(
          { error: 'A cuisine with this name already exists' },
          { status: 409 }
        );
      }
    }

    const updatedCuisine = await prisma.cuisine.update({
      where: { id: parseInt(id) },
      data: {
        name: data.name.trim(),
      },
    });

    return NextResponse.json(updatedCuisine);
  } catch (error) {
    console.error('Error updating cuisine:', error);
    return NextResponse.json(
      { error: 'Failed to update cuisine' },
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
        { error: 'Valid cuisine ID is required' },
        { status: 400 }
      );
    }

    // Check if cuisine exists
    const cuisine = await prisma.cuisine.findUnique({
      where: { id: parseInt(id) },
      include: {
        outlets: {
          select: { outletId: true } // Changed from id to outletId
        }
      },
    });

    if (!cuisine) {
      return NextResponse.json(
        { error: 'Cuisine not found' },
        { status: 404 }
      );
    }

    // Check if cuisine is being used by any outlets
    if (cuisine.outlets.length > 0) {
      return NextResponse.json(
        { 
          error: 'Cannot delete: Cuisine is being used by one or more outlets',
          outletsCount: cuisine.outlets.length,
        },
        { status: 400 }
      );
    }

    await prisma.cuisine.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json({ 
      success: true,
      message: 'Cuisine deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting cuisine:', error);
    return NextResponse.json(
      { error: 'Failed to delete cuisine' },
      { status: 500 }
    );
  }
}
