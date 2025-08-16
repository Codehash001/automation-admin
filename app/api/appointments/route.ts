import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Human-readable date formatter: e.g. "08th OCT 2025 - 09.30 PM"
function formatAppointmentDate(dateInput: string | Date): string {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return "Invalid Date";
  const day = d.getDate();
  const month = d.toLocaleString("en-US", { month: "short" }).toUpperCase();
  const year = d.getFullYear();
  const getSuffix = (n: number) => {
    const j = n % 10, k = n % 100;
    if (j === 1 && k !== 11) return "st";
    if (j === 2 && k !== 12) return "nd";
    if (j === 3 && k !== 13) return "rd";
    return "th";
  };
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  return `${String(day).padStart(2, "0")}${getSuffix(day)} ${month} ${year} - ${hh}.${mm} ${ampm}`;
}

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
    const { customerId, appointmentPlaceId, appointmentDate, status, numberOfGuests, appointmentSetter, specialistName } = body;

    // Validate required fields
    if (!customerId || !appointmentPlaceId || !appointmentDate) {
      return NextResponse.json(
        { error: "Customer ID, appointment place ID, and appointment date are required" },
        { status: 400 }
      );
    }

    // Normalize IDs in case they are sent as strings
    const customerIdNum = Number.parseInt(String(customerId), 10);
    const appointmentPlaceIdNum = Number.parseInt(String(appointmentPlaceId), 10);
    if (!Number.isFinite(customerIdNum) || Number.isNaN(customerIdNum)) {
      return NextResponse.json({ error: "customerId must be a valid integer" }, { status: 400 });
    }
    if (!Number.isFinite(appointmentPlaceIdNum) || Number.isNaN(appointmentPlaceIdNum)) {
      return NextResponse.json({ error: "appointmentPlaceId must be a valid integer" }, { status: 400 });
    }

    // Validate appointmentDate
    const parsedDate = new Date(appointmentDate);
    if (Number.isNaN(parsedDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid appointmentDate. Use ISO 8601, e.g. 2025-08-10T14:00:00Z or 2025-08-10T14:00:00+00:00" },
        { status: 400 }
      );
    }

    // Verify customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: customerIdNum },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    // Verify appointment place exists
    const appointmentPlace = await prisma.appointmentPlace.findUnique({
      where: { id: appointmentPlaceIdNum },
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

    // Normalize optional specialist name
    const normalizedSpecialistName = typeof specialistName === 'string' ? specialistName.trim() : '';

    // Create the appointment
    const appointment = await prisma.appointment.create({
      data: {
        customerId: customerIdNum,
        appointmentPlaceId: appointmentPlaceIdNum,
        appointmentDate: parsedDate,
        status: status || "SCHEDULED",
        ...(appointmentSetter ? { appointmentSetter } : {}),
        ...(normalizedSpecialistName ? { specialistName: normalizedSpecialistName } : {}),
        // numberOfGuests is only relevant for Restaurant appointments
        ...(appointmentPlace.appointmentType?.name?.toLowerCase() === 'restaurant'
          ? (typeof numberOfGuests === 'number' && Number.isFinite(numberOfGuests) && numberOfGuests > 0
              ? { numberOfGuests: Math.floor(numberOfGuests) }
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

    return NextResponse.json({
      ...appointment,
      appointmentDateFormatted: formatAppointmentDate(appointment.appointmentDate as any),
    }, { status: 201 });
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
    const { id, customerId, appointmentPlaceId, appointmentDate, status, numberOfGuests, appointmentSetter } = body;

    if (!id) {
      return NextResponse.json(
        { error: "ID is required" },
        { status: 400 }
      );
    }

    // Normalize main ID
    const idNum = Number.parseInt(String(id), 10);
    if (!Number.isFinite(idNum) || Number.isNaN(idNum)) {
      return NextResponse.json({ error: "id must be a valid integer" }, { status: 400 });
    }

    const existingAppointment = await prisma.appointment.findUnique({
      where: { id: idNum },
      include: {
        appointmentPlace: { include: { appointmentType: { select: { id: true, name: true } } } },
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

    if (typeof customerId !== 'undefined') {
      const cid = Number.parseInt(String(customerId), 10);
      if (!Number.isFinite(cid) || Number.isNaN(cid)) {
        return NextResponse.json({ error: "customerId must be a valid integer" }, { status: 400 });
      }
      updateData.customerId = cid;
    }

    if (typeof appointmentPlaceId !== 'undefined') {
      const apid = Number.parseInt(String(appointmentPlaceId), 10);
      if (!Number.isFinite(apid) || Number.isNaN(apid)) {
        return NextResponse.json({ error: "appointmentPlaceId must be a valid integer" }, { status: 400 });
      }
      updateData.appointmentPlaceId = apid;
    }

    if (appointmentDate) {
      updateData.appointmentDate = new Date(appointmentDate);
    }

    if (status) {
      updateData.status = status;
    }

    if (typeof appointmentSetter !== 'undefined') {
      if (appointmentSetter === null || appointmentSetter === '') {
        updateData.appointmentSetter = null;
      } else {
        updateData.appointmentSetter = String(appointmentSetter);
      }
    }

    // Handle numberOfGuests updates only for Restaurant appointments
    const effectivePlaceType = appointmentPlaceId
      ? (await prisma.appointmentPlace.findUnique({
          where: { id: parseInt(appointmentPlaceId) },
          select: { appointmentType: { select: { name: true } } },
        }))?.appointmentType?.name?.toLowerCase()
      : existingAppointment.appointmentPlace.appointmentType?.name?.toLowerCase();

    if (typeof numberOfGuests !== 'undefined') {
      if (effectivePlaceType === 'restaurant') {
        if (
          typeof numberOfGuests === 'number' &&
          Number.isFinite(numberOfGuests) &&
          numberOfGuests > 0
        ) {
          updateData.numberOfGuests = Math.floor(numberOfGuests);
        } else if (numberOfGuests === null) {
          // Allow clearing
          updateData.numberOfGuests = null;
        } else {
          return NextResponse.json(
            { error: 'numberOfGuests must be a positive integer for restaurant appointments' },
            { status: 400 }
          );
        }
      } else {
        // Ignore numberOfGuests for non-restaurant appointments
      }
    }

    // Update the appointment
    const updatedAppointment = await prisma.appointment.update({
      where: { id: idNum },
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
