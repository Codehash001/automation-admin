import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: Fetch appointment types with optional filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const includePlaces = searchParams.get("includePlaces") === "true";
    const includeAppointmentCounts = searchParams.get("includeAppointmentCounts") === "true";
    
    // If ID is provided, fetch a specific appointment type
    if (id) {
      const appointmentType = await prisma.appointmentType.findUnique({
        where: { id: parseInt(id) },
        include: {
          places: includePlaces ? {
            include: {
              _count: includeAppointmentCounts ? {
                select: {
                  appointments: true,
                },
              } : undefined,
            },
          } : false,
          _count: includeAppointmentCounts ? {
            select: {
              places: true,
            },
          } : undefined,
        },
      });

      if (!appointmentType) {
        return NextResponse.json(
          { error: "Appointment type not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(appointmentType);
    }

    // Otherwise, fetch all appointment types
    const appointmentTypes = await prisma.appointmentType.findMany({
      include: {
        places: includePlaces ? {
          include: {
            _count: includeAppointmentCounts ? {
              select: {
                appointments: true,
              },
            } : undefined,
          },
        } : false,
        _count: includeAppointmentCounts ? {
          select: {
            places: true,
          },
        } : undefined,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json(appointmentTypes);
  } catch (error) {
    console.error("Error fetching appointment types:", error);
    return NextResponse.json(
      { error: "Failed to fetch appointment types" },
      { status: 500 }
    );
  }
}

// POST: Create a new appointment type
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    // Check if appointment type with same name already exists
    const existingType = await prisma.appointmentType.findUnique({
      where: { name: name.trim() },
    });

    if (existingType) {
      return NextResponse.json(
        { error: "Appointment type with this name already exists" },
        { status: 409 }
      );
    }

    // Create the appointment type
    const appointmentType = await prisma.appointmentType.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
      },
      include: {
        _count: {
          select: {
            places: true,
          },
        },
      },
    });

    return NextResponse.json(appointmentType, { status: 201 });
  } catch (error) {
    console.error("Error creating appointment type:", error);
    return NextResponse.json(
      { error: "Failed to create appointment type" },
      { status: 500 }
    );
  }
}

// PUT: Update an existing appointment type
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, description } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Appointment type ID is required" },
        { status: 400 }
      );
    }

    // Check if appointment type exists
    const existingType = await prisma.appointmentType.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingType) {
      return NextResponse.json(
        { error: "Appointment type not found" },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {};

    if (name) {
      const trimmedName = name.trim();
      
      // Check if another appointment type with same name exists
      const duplicateType = await prisma.appointmentType.findFirst({
        where: {
          name: trimmedName,
          id: { not: parseInt(id) },
        },
      });

      if (duplicateType) {
        return NextResponse.json(
          { error: "Appointment type with this name already exists" },
          { status: 409 }
        );
      }

      updateData.name = trimmedName;
    }

    if (description !== undefined) {
      updateData.description = description?.trim() || null;
    }

    // Update the appointment type
    const updatedType = await prisma.appointmentType.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        _count: {
          select: {
            places: true,
          },
        },
      },
    });

    return NextResponse.json(updatedType);
  } catch (error) {
    console.error("Error updating appointment type:", error);
    return NextResponse.json(
      { error: "Failed to update appointment type" },
      { status: 500 }
    );
  }
}

// DELETE: Delete an appointment type
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Appointment type ID is required" },
        { status: 400 }
      );
    }

    // Check if appointment type exists
    const existingType = await prisma.appointmentType.findUnique({
      where: { id: parseInt(id) },
      include: {
        places: {
          include: {
            _count: {
              select: {
                appointments: true,
              },
            },
          },
        },
      },
    });

    if (!existingType) {
      return NextResponse.json(
        { error: "Appointment type not found" },
        { status: 404 }
      );
    }

    // Check if there are associated places
    if (existingType.places.length > 0) {
      const totalAppointments = existingType.places.reduce(
        (sum, place) => sum + place._count.appointments,
        0
      );

      return NextResponse.json(
        {
          error: `Cannot delete appointment type. It has ${existingType.places.length} associated place(s) with ${totalAppointments} appointment(s). Please delete or reassign the places first.`,
        },
        { status: 400 }
      );
    }

    // Delete the appointment type
    await prisma.appointmentType.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json(
      { message: "Appointment type deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting appointment type:", error);
    return NextResponse.json(
      { error: "Failed to delete appointment type" },
      { status: 500 }
    );
  }
}
