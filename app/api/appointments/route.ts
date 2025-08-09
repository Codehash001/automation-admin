import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: Fetch appointments with optional filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const customerId = searchParams.get("customerId");
    const appointmentPlaceId = searchParams.get("appointmentPlaceId");
    const appointmentTypeId = searchParams.get("appointmentTypeId");
    const status = searchParams.get("status");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    
    // If ID is provided, fetch a specific appointment
    if (id) {
      const appointment = await prisma.appointment.findUnique({
        where: { id: parseInt(id) },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              whatsappNumber: true,
            },
          },
          appointmentPlace: {
            include: {
              appointmentType: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      if (!appointment) {
        return NextResponse.json(
          { error: "Appointment not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(appointment);
    }

    // Otherwise, fetch all appointments with optional filters
    const where: any = {};
    
    if (customerId) {
      where.customerId = parseInt(customerId);
    }

    if (appointmentPlaceId) {
      where.appointmentPlaceId = parseInt(appointmentPlaceId);
    }

    if (appointmentTypeId) {
      where.appointmentPlace = {
        appointmentTypeId: parseInt(appointmentTypeId),
      };
    }

    if (status) {
      where.status = status;
    }

    // Date range filtering
    if (dateFrom || dateTo) {
      where.appointmentDate = {};
      if (dateFrom) {
        where.appointmentDate.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.appointmentDate.lte = new Date(dateTo);
      }
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            whatsappNumber: true,
          },
        },
        appointmentPlace: {
          include: {
            appointmentType: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        appointmentDate: 'asc',
      },
    });

    return NextResponse.json(appointments);
  } catch (error) {
    console.error("Error fetching appointments:", error);
    return NextResponse.json(
      { error: "Failed to fetch appointments" },
      { status: 500 }
    );
  }
}

// POST: Create a new appointment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerId, appointmentPlaceId, appointmentDate, status, numberOfTables } = body;

    // Validate required fields
    if (!customerId || !appointmentPlaceId || !appointmentDate) {
      return NextResponse.json(
        { error: "Customer ID, appointment place ID, and appointment date are required" },
        { status: 400 }
      );
    }

    // Verify customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: parseInt(customerId) },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    // Verify appointment place exists
    const appointmentPlace = await prisma.appointmentPlace.findUnique({
      where: { id: parseInt(appointmentPlaceId) },
      include: {
        appointmentType: { select: { id: true, name: true } },
      },
    });

    if (!appointmentPlace) {
      return NextResponse.json(
        { error: "Appointment place not found" },
        { status: 404 }
      );
    }

    // Check if appointment place is active
    if (appointmentPlace.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Appointment place is not active" },
        { status: 400 }
      );
    }

    // Create the appointment
    const appointment = await prisma.appointment.create({
      data: {
        customerId: parseInt(customerId),
        appointmentPlaceId: parseInt(appointmentPlaceId),
        appointmentDate: new Date(appointmentDate),
        status: status || "SCHEDULED",
        // numberOfTables is only relevant for Restaurant appointments
        ...(appointmentPlace.appointmentType?.name?.toLowerCase() === 'restaurant'
          ? (typeof numberOfTables === 'number' && Number.isFinite(numberOfTables) && numberOfTables > 0
              ? { numberOfTables: Math.floor(numberOfTables) }
              : {})
          : {}),
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            whatsappNumber: true,
          },
        },
        appointmentPlace: {
          include: {
            appointmentType: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(appointment, { status: 201 });
  } catch (error) {
    console.error("Error creating appointment:", error);
    return NextResponse.json(
      { error: "Failed to create appointment" },
      { status: 500 }
    );
  }
}

// PUT: Update an existing appointment
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, customerId, appointmentPlaceId, appointmentDate, status, numberOfTables } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Appointment ID is required" },
        { status: 400 }
      );
    }

    // Check if appointment exists
    const existingAppointment = await prisma.appointment.findUnique({
      where: { id: parseInt(id) },
      include: {
        appointmentPlace: { include: { appointmentType: { select: { name: true } } } },
      },
    });

    if (!existingAppointment) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {};

    if (customerId) {
      // Verify customer exists
      const customer = await prisma.customer.findUnique({
        where: { id: parseInt(customerId) },
      });

      if (!customer) {
        return NextResponse.json(
          { error: "Customer not found" },
          { status: 404 }
        );
      }

      updateData.customerId = parseInt(customerId);
    }

    if (appointmentPlaceId) {
      // Verify appointment place exists and is active
      const appointmentPlace = await prisma.appointmentPlace.findUnique({
        where: { id: parseInt(appointmentPlaceId) },
        include: { appointmentType: { select: { name: true } } },
      });

      if (!appointmentPlace) {
        return NextResponse.json(
          { error: "Appointment place not found" },
          { status: 404 }
        );
      }

      if (appointmentPlace.status !== "ACTIVE") {
        return NextResponse.json(
          { error: "Appointment place is not active" },
          { status: 400 }
        );
      }

      updateData.appointmentPlaceId = parseInt(appointmentPlaceId);
    }

    if (appointmentDate) {
      updateData.appointmentDate = new Date(appointmentDate);
    }

    if (status) {
      updateData.status = status;
    }

    // Handle numberOfTables updates only for Restaurant appointments
    const effectivePlaceType = appointmentPlaceId
      ? (await prisma.appointmentPlace.findUnique({
          where: { id: parseInt(appointmentPlaceId) },
          select: { appointmentType: { select: { name: true } } },
        }))?.appointmentType?.name?.toLowerCase()
      : existingAppointment.appointmentPlace.appointmentType?.name?.toLowerCase();

    if (typeof numberOfTables !== 'undefined') {
      if (effectivePlaceType === 'restaurant') {
        if (
          typeof numberOfTables === 'number' &&
          Number.isFinite(numberOfTables) &&
          numberOfTables > 0
        ) {
          updateData.numberOfTables = Math.floor(numberOfTables);
        } else if (numberOfTables === null) {
          // Allow clearing
          updateData.numberOfTables = null;
        } else {
          return NextResponse.json(
            { error: 'numberOfTables must be a positive integer for restaurant appointments' },
            { status: 400 }
          );
        }
      } else {
        // Ignore numberOfTables for non-restaurant appointments
      }
    }

    // Update the appointment
    const updatedAppointment = await prisma.appointment.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            whatsappNumber: true,
          },
        },
        appointmentPlace: {
          include: {
            appointmentType: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(updatedAppointment);
  } catch (error) {
    console.error("Error updating appointment:", error);
    return NextResponse.json(
      { error: "Failed to update appointment" },
      { status: 500 }
    );
  }
}

// DELETE: Delete an appointment
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Appointment ID is required" },
        { status: 400 }
      );
    }

    // Check if appointment exists
    const existingAppointment = await prisma.appointment.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingAppointment) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      );
    }

    // Delete the appointment
    await prisma.appointment.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json(
      { message: "Appointment deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting appointment:", error);
    return NextResponse.json(
      { error: "Failed to delete appointment" },
      { status: 500 }
    );
  }
}
