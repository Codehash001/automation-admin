import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const prices = await prisma.additionalPrice.findMany();
    return NextResponse.json(prices);
  } catch (error) {
    console.error('Error fetching additional prices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch additional prices' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { name, value, type, isActive } = await request.json();
    
    // Validate input
    if (!name || value === undefined || !type) {
      return NextResponse.json(
        { error: 'Name, value, and type are required' },
        { status: 400 }
      );
    }

    const price = await prisma.additionalPrice.upsert({
      where: { name },
      update: {
        value,
        type,
        isActive: isActive ?? true,
      },
      create: {
        name,
        value,
        type,
        isActive: isActive ?? true,
      },
    });

    return NextResponse.json(price);
  } catch (error) {
    console.error('Error updating additional prices:', error);
    return NextResponse.json(
      { error: 'Failed to update additional prices' },
      { status: 500 }
    );
  }
}
