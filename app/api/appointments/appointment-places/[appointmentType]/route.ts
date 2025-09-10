import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Normalize specialists payload: accept string | string[] | undefined and return a clean string[]
function normalizeSpecialists(input: unknown): string[] {
  if (input == null) return [];
  if (Array.isArray(input)) {
    return input
      .map((s) => (typeof s === "string" ? s.trim() : ""))
      .filter((s) => s.length > 0);
  }
  if (typeof input === "string") {
    const single = input.trim();
    return single ? [single] : [];
  }
  return [];
}

// GET: Fetch appointment places by appointment type
export async function GET(
  request: NextRequest,
  { params }: { params: { appointmentType: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const includeAppointments = searchParams.get("includeAppointments") === "true";
    const status = searchParams.get("status"); // legacy status (ACTIVE/INACTIVE)
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

    // Backward-compatibility filter on legacy string status if provided
    if (status) {
      whereClause.status = status.toUpperCase();
    }

    // serviceStatus removed from schema; no filtering here

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
      // Backward compatibility: accept either specialistName (string) or specialistNames (string[])
      specialistName,
      specialistNames,
      whatsappNo,
      status = "ACTIVE",
      exactLocation = { lat: 0.0, lng: 0.0 },
      operatingHours, // { open: "HH:mm", close: "HH:mm" } (optional)
      serviceFee, // optional decimal (AED)
      address,
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
    const createData: any = {
      name: name.trim(),
      appointmentTypeId: appointmentType.id,
      specialistNames: normalizeSpecialists(
        typeof specialistNames !== 'undefined' ? specialistNames : specialistName
      ),
      whatsappNo: whatsappNo.trim(),
      status: status.toUpperCase(),
      exactLocation: exactLocation,
      serviceFee: typeof serviceFee !== 'undefined' && serviceFee !== null ? Number(serviceFee) : undefined,
      address: address.trim(),
    };

    // serviceStatus removed from schema; nothing to add
    if (operatingHours && typeof operatingHours === 'object') {
      createData.operatingHours = operatingHours;
    }

    const appointmentPlace = await prisma.appointmentPlace.create({
      data: createData,
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
      // Backward compatibility: accept either specialistName (string) or specialistNames (string[])
      specialistName,
      specialistNames,
      whatsappNo,
      status,
      exactLocation,
      operatingHours,
      serviceFee,
      address,
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
        id: Number.parseInt(String(id), 10),
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
          id: { not: Number.parseInt(String(id), 10) },
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

    if (typeof specialistNames !== 'undefined' || typeof specialistName !== 'undefined') {
      updateData.specialistNames = normalizeSpecialists(
        typeof specialistNames !== 'undefined' ? specialistNames : specialistName
      );
    }

    if (whatsappNo) {
      updateData.whatsappNo = whatsappNo.trim();
    }

    if (status) {
      updateData.status = status.toUpperCase();
    }

    // serviceStatus removed from schema; skip updates

    if (exactLocation) {
      updateData.exactLocation = exactLocation;
    }

    if (operatingHours && typeof operatingHours === 'object') {
      updateData.operatingHours = operatingHours;
    }

    if (address) {
      updateData.address = address.trim();
    }

    if (typeof serviceFee !== 'undefined' && serviceFee !== null) {
      const feeNum = Number(serviceFee);
      if (!Number.isFinite(feeNum) || feeNum < 0) {
        return NextResponse.json(
          { error: 'Invalid serviceFee. It must be a non-negative number.' },
          { status: 400 }
        );
      }
      updateData.serviceFee = feeNum;
    }

    // Update the appointment place
    const updatedPlace = await prisma.appointmentPlace.update({
      where: { id: Number.parseInt(String(id), 10) },
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
        id: Number.parseInt(String(id), 10),
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
      where: { id: Number.parseInt(String(id), 10) },
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
