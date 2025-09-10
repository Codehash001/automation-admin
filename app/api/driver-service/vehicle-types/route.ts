import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { RideServiceCategory } from '@prisma/client';

// GET /api/driver-service/vehicle-types
// Optional query params:
// - category=TRADITIONAL_TAXI|LIMOUSINE
// - includeInactive=true
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') as RideServiceCategory | null;
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const where: any = {};
    if (category) where.category = category;
    if (!includeInactive) where.isActive = true;

    const items = await prisma.vehicleType.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    return NextResponse.json(items);
  } catch (e) {
    console.error('GET vehicle-types error', e);
    return NextResponse.json({ error: 'Failed to fetch vehicle types' }, { status: 500 });
  }
}

// POST /api/driver-service/vehicle-types
// body: { category: 'TRADITIONAL_TAXI'|'LIMOUSINE', name: string, capacity: number, isActive?: boolean }
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { category, name } = body as { category?: RideServiceCategory; name?: string };
    let { capacity, isActive } = body as { capacity?: number; isActive?: boolean };

    if (!category || !['TRADITIONAL_TAXI', 'LIMOUSINE'].includes(category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    capacity = Number(capacity);
    if (!capacity || isNaN(capacity) || capacity <= 0) {
      return NextResponse.json({ error: 'Capacity must be a positive number' }, { status: 400 });
    }

    const created = await prisma.vehicleType.create({
      data: {
        category,
        name,
        capacity,
        isActive: isActive ?? true,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'Vehicle type already exists for this category' }, { status: 400 });
    }
    console.error('POST vehicle-types error', e);
    return NextResponse.json({ error: 'Failed to create vehicle type' }, { status: 500 });
  }
}

// PUT /api/driver-service/vehicle-types?id=123
export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get('id'));
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    const body = await request.json();
    const data: any = {};

    if (body.category) {
      if (!['TRADITIONAL_TAXI', 'LIMOUSINE'].includes(body.category)) {
        return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
      }
      data.category = body.category as RideServiceCategory;
    }
    if (typeof body.name === 'string') data.name = body.name;
    if (body.capacity !== undefined && body.capacity !== null) {
      const cap = Number(body.capacity);
      if (!cap || isNaN(cap) || cap <= 0) return NextResponse.json({ error: 'Capacity must be a positive number' }, { status: 400 });
      data.capacity = cap;
    }
    if (typeof body.isActive === 'boolean') data.isActive = body.isActive;

    const updated = await prisma.vehicleType.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'Vehicle type already exists for this category' }, { status: 400 });
    }
    console.error('PUT vehicle-types error', e);
    return NextResponse.json({ error: 'Failed to update vehicle type' }, { status: 500 });
  }
}

// DELETE /api/driver-service/vehicle-types?id=123
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get('id'));
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    const inUse = await prisma.driver.count({ where: { rideVehicleTypeRefId: id } });
    if (inUse > 0) {
      return NextResponse.json({ error: 'Cannot delete: one or more riders use this vehicle type' }, { status: 400 });
    }

    await prisma.vehicleType.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (e) {
    console.error('DELETE vehicle-types error', e);
    return NextResponse.json({ error: 'Failed to delete vehicle type' }, { status: 500 });
  }
}
