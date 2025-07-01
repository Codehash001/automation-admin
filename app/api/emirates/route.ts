import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/prisma';

// Enable debug logging
const debug = process.env.NODE_ENV !== 'production';

function logError(method: string, error: unknown, message: string) {
  console.error(`[${method}] ${message}:`, error);
  if (error instanceof Error) {
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');

    if (name) {
      // Get emirate by name
      if (debug) console.log(`[GET /api/emirates] Fetching emirate with name: ${name}`);
      
      const emirate = await prisma.emirates.findFirst({
        where: { 
          name: { 
            equals: name,
            mode: 'insensitive' // Case-insensitive search
          } 
        },
        select: {
          id: true,
          name: true,
          _count: {
            select: {
              outlets: true,
              orders: true
            }
          }
        }
      });

      if (!emirate) {
        return NextResponse.json(
          { error: `Emirate with name "${name}" not found` },
          { status: 404 }
        );
      }

      
      if (debug) console.log(`[GET /api/emirates] Found emirate:`, emirate);
      return NextResponse.json(emirate);
    }

    // Get all emirates
    if (debug) console.log('[GET /api/emirates] Fetching all emirates...');
    
    const emirates = await prisma.emirates.findMany({
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            outlets: true,
            orders: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    if (debug) console.log(`[GET /api/emirates] Found ${emirates.length} emirates`);
    return NextResponse.json(emirates);
  } catch (error) {
    logError('GET', error, 'Failed to fetch emirates');
    return NextResponse.json(
      { 
        error: 'Failed to fetch emirates',
        details: debug && error instanceof Error ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (debug) console.log('[POST /api/emirates] Request body:', body);
    
    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json(
        { error: 'Name is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    const name = body.name.trim();
    
    // Check if emirate with this name already exists
    const existingEmirate = await prisma.emirates.findFirst({
      where: { name },
      select: { id: true, name: true }
    });

    if (existingEmirate) {
      return NextResponse.json(
        { error: `An emirate with the name "${name}" already exists` },
        { status: 409 } // Conflict
      );
    }

    const emirate = await prisma.emirates.create({
      data: { name },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            outlets: true,
            orders: true
          }
        }
      }
    });

    if (debug) console.log('[POST /api/emirates] Created emirate:', emirate);
    return NextResponse.json(emirate, { status: 201 });
  } catch (error) {
    logError('POST', error, 'Failed to create emirate');
    return NextResponse.json(
      { 
        error: 'Failed to create emirate',
        details: debug && error instanceof Error ? error.message : undefined
      },
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
        { error: 'ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    if (debug) console.log('[PUT /api/emirates] Request body:', body);
    
    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json(
        { error: 'Name is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    const name = body.name.trim();
    
    const updatedEmirate = await prisma.emirates.update({
      where: { id: parseInt(id) },
      data: { name },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            outlets: true,
            orders: true
          }
        }
      }
    });
    
    if (debug) console.log('[PUT /api/emirates] Updated emirate:', updatedEmirate);
    return NextResponse.json(updatedEmirate);
  } catch (error) {
    logError('PUT', error, 'Failed to update emirate');
    return NextResponse.json(
      { 
        error: 'Failed to update emirate',
        details: debug && error instanceof Error ? error.message : undefined
      },
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
        { error: 'ID is required' },
        { status: 400 }
      );
    }

    if (debug) console.log(`[DELETE /api/emirates] Deleting emirate with ID ${id}...`);
    
    await prisma.emirates.delete({
      where: { id: parseInt(id) },
    });
    
    if (debug) console.log(`[DELETE /api/emirates] Emirate with ID ${id} deleted`);
    return NextResponse.json({ message: 'Emirate deleted successfully' });
  } catch (error) {
    logError('DELETE', error, 'Failed to delete emirate');
    return NextResponse.json(
      { 
        error: 'Failed to delete emirate',
        details: debug && error instanceof Error ? error.message : undefined
      },
      { status: 500 }
    );
  }
}
