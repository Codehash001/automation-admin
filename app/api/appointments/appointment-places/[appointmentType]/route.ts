import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: Fetch appointment places by appointment type
export async function GET(
  request: NextRequest,
  { params }: { params: { appointmentType: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const includeAppointments = searchParams.get("includeAppointments") === "true";
    const status = searchParams.get("status");
    const appointmentTypeName = params.appointmentType.toLowerCase();

    // First, find the appointment type by name
    const appointmentType = await prisma.appointmentType.findFirst({
      where: {
        name: {
          contains: appointmentTypeName,
          mode: 'insensitive',
        },
      },
    });

    if (!appointmentType) {
      return NextResponse.json(
        { error: `Appointment type '${appointmentTypeName}' not found` },
        { status: 404 }
      );
    }

    // If ID is provided, fetch a specific appointment place
    if (id) {
      const appointmentPlace = await prisma.appointmentPlace.findFirst({
        where: {
          id: parseInt(id),
          appointmentTypeId: appointmentType.id,
        },
        include: {
          appointmentType: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
          appointments: includeAppointments ? {
            include: {
              customer: {
                select: {
                  id: true,
                  name: true,
                  whatsappNumber: true,
                },
              },
            },
            orderBy: {
              appointmentDate: 'asc',
            },
          } : false,
          _count: {
            select: {
              appointments: true,
            },
          },
        },
      });

      if (!appointmentPlace) {
        return NextResponse.json(
          { error: `${appointmentTypeName} place not found` },
          { status: 404 }
        );
      }

      return NextResponse.json(appointmentPlace);
    }

    // Build where clause for filtering
    const whereClause: any = {
      appointmentTypeId: appointmentType.id,
    };

    if (status) {
      whereClause.status = status.toUpperCase();
    }

    // Otherwise, fetch all appointment places for this type
    const appointmentPlaces = await prisma.appointmentPlace.findMany({
      where: whereClause,
      include: {
        appointmentType: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        appointments: includeAppointments ? {
          include: {
            customer: {
              select: {
                id: true,
                name: true,
                whatsappNumber: true,
              },
            },
          },
          orderBy: {
            appointmentDate: 'asc',
          },
        } : false,
        _count: {
          select: {
            appointments: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json({
      appointmentType: {
        id: appointmentType.id,
        name: appointmentType.name,
        description: appointmentType.description,
      },
      places: appointmentPlaces,
      total: appointmentPlaces.length,
    });
  } catch (error) {
    console.error(`Error fetching ${params.appointmentType} places:`, error);
    return NextResponse.json(
      { error: `Failed to fetch ${params.appointmentType} places` },
      { status: 500 }
    );
  }
}

// POST: Create a new appointment place
export async function POST(
  request: NextRequest,
  { params }: { params: { appointmentType: string } }
) {
  try {
    const body = await request.json();
    const {
      name,
      specialistName,
      whatsappNo,
      status = "ACTIVE",
      exactLocation = { lat: 0.0, lng: 0.0 },
      address,
      numberOfAppointedPeople = 1,
    } = body;

    const appointmentTypeName = params.appointmentType.toLowerCase();

    // Validate required fields
    if (!name || !whatsappNo || !address) {
      return NextResponse.json(
        { error: "Name, WhatsApp number, and address are required" },
        { status: 400 }
      );
    }

    // Find the appointment type by name
    const appointmentType = await prisma.appointmentType.findFirst({
      where: {
        name: {
          contains: appointmentTypeName,
          mode: 'insensitive',
        },
      },
    });

    if (!appointmentType) {
      return NextResponse.json(
        { error: `Appointment type '${appointmentTypeName}' not found` },
        { status: 404 }
      );
    }

    // Check if place with same name already exists for this appointment type
    const existingPlace = await prisma.appointmentPlace.findFirst({
      where: {
        name: name.trim(),
        appointmentTypeId: appointmentType.id,
      },
    });

    if (existingPlace) {
      return NextResponse.json(
        { error: `${appointmentTypeName} place with this name already exists` },
        { status: 409 }
      );
    }

    // Create the appointment place
    const appointmentPlace = await prisma.appointmentPlace.create({
      data: {
        name: name.trim(),
        appointmentTypeId: appointmentType.id,
        specialistName: specialistName?.trim() || null,
        whatsappNo: whatsappNo.trim(),
        status: status.toUpperCase(),
        exactLocation: exactLocation,
        address: address.trim(),
        numberOfAppointedPeople: parseInt(numberOfAppointedPeople) || 1,
      },
      include: {
        appointmentType: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        _count: {
          select: {
            appointments: true,
          },
        },
      },
    });

    return NextResponse.json(appointmentPlace, { status: 201 });
  } catch (error) {
    console.error(`Error creating ${params.appointmentType} place:`, error);
    return NextResponse.json(
      { error: `Failed to create ${params.appointmentType} place` },
      { status: 500 }
    );
  }
}

// PUT: Update an existing appointment place
export async function PUT(
  request: NextRequest,
  { params }: { params: { appointmentType: string } }
) {
  try {
    const body = await request.json();
    const {
      id,
      name,
      specialistName,
      whatsappNo,
      status,
      exactLocation,
      address,
      numberOfAppointedPeople,
    } = body;

    const appointmentTypeName = params.appointmentType.toLowerCase();

    if (!id) {
      return NextResponse.json(
        { error: "Place ID is required" },
        { status: 400 }
      );
    }

    // Find the appointment type by name
    const appointmentType = await prisma.appointmentType.findFirst({
      where: {
        name: {
          contains: appointmentTypeName,
          mode: 'insensitive',
        },
      },
    });

    if (!appointmentType) {
      return NextResponse.json(
        { error: `Appointment type '${appointmentTypeName}' not found` },
        { status: 404 }
      );
    }

    // Check if appointment place exists and belongs to this type
    const existingPlace = await prisma.appointmentPlace.findFirst({
      where: {
        id: parseInt(id),
        appointmentTypeId: appointmentType.id,
      },
    });

    if (!existingPlace) {
      return NextResponse.json(
        { error: `${appointmentTypeName} place not found` },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {};

    if (name) {
      const trimmedName = name.trim();
      
      // Check if another place with same name exists for this type
      const duplicatePlace = await prisma.appointmentPlace.findFirst({
        where: {
          name: trimmedName,
          appointmentTypeId: appointmentType.id,
          id: { not: parseInt(id) },
        },
      });

      if (duplicatePlace) {
        return NextResponse.json(
          { error: `${appointmentTypeName} place with this name already exists` },
          { status: 409 }
        );
      }

      updateData.name = trimmedName;
    }

    if (specialistName !== undefined) {
      updateData.specialistName = specialistName?.trim() || null;
    }

    if (whatsappNo) {
      updateData.whatsappNo = whatsappNo.trim();
    }

    if (status) {
      updateData.status = status.toUpperCase();
    }

    if (exactLocation) {
      updateData.exactLocation = exactLocation;
    }

    if (address) {
      updateData.address = address.trim();
    }

    if (numberOfAppointedPeople !== undefined) {
      updateData.numberOfAppointedPeople = parseInt(numberOfAppointedPeople) || 1;
    }

    // Update the appointment place
    const updatedPlace = await prisma.appointmentPlace.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        appointmentType: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        _count: {
          select: {
            appointments: true,
          },
        },
      },
    });

    return NextResponse.json(updatedPlace);
  } catch (error) {
    console.error(`Error updating ${params.appointmentType} place:`, error);
    return NextResponse.json(
      { error: `Failed to update ${params.appointmentType} place` },
      { status: 500 }
    );
  }
}

// DELETE: Delete an appointment place
export async function DELETE(
  request: NextRequest,
  { params }: { params: { appointmentType: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const appointmentTypeName = params.appointmentType.toLowerCase();

    if (!id) {
      return NextResponse.json(
        { error: "Place ID is required" },
        { status: 400 }
      );
    }

    // Find the appointment type by name
    const appointmentType = await prisma.appointmentType.findFirst({
      where: {
        name: {
          contains: appointmentTypeName,
          mode: 'insensitive',
        },
      },
    });

    if (!appointmentType) {
      return NextResponse.json(
        { error: `Appointment type '${appointmentTypeName}' not found` },
        { status: 404 }
      );
    }

    // Check if appointment place exists and belongs to this type
    const existingPlace = await prisma.appointmentPlace.findFirst({
      where: {
        id: parseInt(id),
        appointmentTypeId: appointmentType.id,
      },
      include: {
        _count: {
          select: {
            appointments: true,
          },
        },
      },
    });

    if (!existingPlace) {
      return NextResponse.json(
        { error: `${appointmentTypeName} place not found` },
        { status: 404 }
      );
    }

    // Check if there are associated appointments
    if (existingPlace._count.appointments > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete ${appointmentTypeName} place. It has ${existingPlace._count.appointments} associated appointment(s). Please cancel or reschedule the appointments first.`,
        },
        { status: 400 }
      );
    }

    // Delete the appointment place
    await prisma.appointmentPlace.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json(
      { message: `${appointmentTypeName} place deleted successfully` },
      { status: 200 }
    );
  } catch (error) {
    console.error(`Error deleting ${params.appointmentType} place:`, error);
    return NextResponse.json(
      { error: `Failed to delete ${params.appointmentType} place` },
      { status: 500 }
    );
  }
}
