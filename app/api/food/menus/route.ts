import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const outletId = searchParams.get('outletId');
    const cuisineId = searchParams.get('cuisineId');
    const menuName = searchParams.get('name');

    // Get current time in hours (24-hour format)
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTime = currentHour + (currentMinutes / 60);

    // Define time windows for different meal types
    const mealTimes = {
      breakfast: { start: 6, end: 11.5 },    // 6:00 AM - 11:30 AM
      lunch: { start: 11.5, end: 16.5 },     // 11:30 AM - 4:30 PM
      dinner: { start: 16.5, end: 23.5 }     // 4:30 PM - 11:30 PM
    };

    // Fetch all menus that match the filters
    let menus = await prisma.menu.findMany({
      where: {
        ...(outletId && { outletId: parseInt(outletId) }),
        ...(cuisineId && { cuisineId: parseInt(cuisineId) }),
        ...(menuName && {
          name: {
            contains: menuName,
            mode: 'insensitive' // Case-insensitive search
          }
        })
      },
      include: {
        cuisine: true,
        outlet: true,
        _count: {
          select: { items: true },
        },
      },
    });

    // Filter menus based on meal times if they are breakfast, lunch, or dinner
    menus = menus.filter(menu => {
      const menuNameLower = menu.name.toLowerCase();
      
      // Skip time filtering for non-meal menus
      if (!['breakfast', 'lunch', 'dinner'].some(meal => menuNameLower.includes(meal))) {
        return true;
      }
      
      // Apply time-based filtering for meal-specific menus
      if (menuNameLower.includes('breakfast')) {
        return currentTime >= mealTimes.breakfast.start && currentTime <= mealTimes.breakfast.end;
      } else if (menuNameLower.includes('lunch')) {
        return currentTime >= mealTimes.lunch.start && currentTime <= mealTimes.lunch.end;
      } else if (menuNameLower.includes('dinner')) {
        return currentTime >= mealTimes.dinner.start && currentTime <= mealTimes.dinner.end;
      }
      
      return true; // Default to showing if no match found (shouldn't happen due to first check)
    });

    return NextResponse.json(menus);
  } catch (error) {
    console.error('Error fetching menus:', error);
    return NextResponse.json(
      { error: 'Failed to fetch menus' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    
    // Validate required fields
    if (!data.name || !data.outletId) {
      return NextResponse.json(
        { error: 'Name and outletId are required' },
        { status: 400 }
      );
    }

    const menu = await prisma.menu.create({
      data: {
        name: data.name,
        description: data.description,
        outletId: parseInt(data.outletId),
        cuisineId: data.cuisineId ? parseInt(data.cuisineId) : null,
        isActive: data.isActive ?? true,
      },
    });

    return NextResponse.json(menu, { status: 201 });
  } catch (error) {
    console.error('Error creating menu:', error);
    return NextResponse.json(
      { error: 'Failed to create menu' },
      { status: 500 }
    );
  }
}
