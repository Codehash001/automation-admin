import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const ratings = await prisma.rating.findMany({
      include: {
        order: {
          include: {
            customer: true,
            outlet: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    return NextResponse.json(ratings);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Failed to fetch ratings' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { orderId, rating, feedback } = await request.json();
    
    // Validate rating
    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5' },
        { status: 400 }
      );
    }

    // Check if the order exists and hasn't been rated yet
    const existingRating = await prisma.rating.findUnique({
      where: { orderId: parseInt(orderId) }
    });

    if (existingRating) {
      return NextResponse.json(
        { error: 'This order has already been rated' },
        { status: 400 }
      );
    }

    const newRating = await prisma.rating.create({
      data: {
        order: { connect: { id: parseInt(orderId) } },
        rating: parseInt(rating),
        feedback
      },
      include: {
        order: {
          include: {
            customer: true,
            outlet: true
          }
        }
      }
    });

    // Calculate average rating for the outlet
    const outletRatings = await prisma.rating.findMany({
      where: {
        order: {
          outletId: newRating.order.outletId
        }
      },
      select: {
        rating: true
      }
    });

    const averageRating = outletRatings.reduce((sum: any, r: { rating: any; }) => sum + r.rating, 0) / outletRatings.length;

    // Update outlet with new average rating (you might want to add an averageRating field to the Outlet model)
    await prisma.outlet.update({
      where: { id: newRating.order.outletId },
      data: {
        // Assuming you have an averageRating field in your Outlet model
        // averageRating: parseFloat(averageRating.toFixed(1))
      }
    });

    return NextResponse.json(newRating, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Failed to create rating' },
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

    const { rating, feedback } = await request.json();
    
    // Validate rating if provided
    if (rating && (rating < 1 || rating > 5)) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5' },
        { status: 400 }
      );
    }

    const updatedRating = await prisma.rating.update({
      where: { id: parseInt(id) },
      data: {
        ...(rating && { rating: parseInt(rating) }),
        ...(feedback !== undefined && { feedback })
      },
      include: {
        order: {
          include: {
            customer: true,
            outlet: true
          }
        }
      }
    });

    // Recalculate average rating for the outlet if rating was updated
    if (rating) {
      const outletRatings = await prisma.rating.findMany({
        where: {
          order: {
            outletId: updatedRating.order.outletId
          }
        },
        select: {
          rating: true
        }
      });

      const averageRating = outletRatings.reduce((sum: any, r: { rating: any; }) => sum + r.rating, 0) / outletRatings.length;

      // Update outlet with new average rating
      await prisma.outlet.update({
        where: { id: updatedRating.order.outletId },
        data: {
          // averageRating: parseFloat(averageRating.toFixed(1))
        }
      });
    }
    
    return NextResponse.json(updatedRating);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Failed to update rating' },
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

    // Get the rating before deleting to update the outlet's average
    const rating = await prisma.rating.findUnique({
      where: { id: parseInt(id) },
      include: {
        order: true
      }
    });

    if (!rating) {
      return NextResponse.json(
        { error: 'Rating not found' },
        { status: 404 }
      );
    }

    await prisma.rating.delete({
      where: { id: parseInt(id) },
    });

    // Recalculate average rating for the outlet
    const outletRatings = await prisma.rating.findMany({
      where: {
        order: {
          outletId: rating.order.outletId
        }
      },
      select: {
        rating: true
      }
    });

    const averageRating = outletRatings.length > 0 
      ? outletRatings.reduce((sum: any, r: { rating: any; }) => sum + r.rating, 0) / outletRatings.length
      : 0;

    // Update outlet with new average rating
    await prisma.outlet.update({
      where: { id: rating.order.outletId },
      data: {
        // averageRating: parseFloat(averageRating.toFixed(1))
      }
    });
    
    return NextResponse.json({ message: 'Rating deleted successfully' });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Failed to delete rating' },
      { status: 500 }
    );
  }
}
