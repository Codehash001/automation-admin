import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/appointments/appointment-places/by-name?name=...&appointmentType=...&appointmentTypeId=...&includeAppointments=true
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name");
    const appointmentType = searchParams.get("appointmentType");
    const appointmentTypeId = searchParams.get("appointmentTypeId");
    const includeAppointments = searchParams.get("includeAppointments") === "true";

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Query parameter 'name' is required" },
        { status: 400 }
      );
    }

    // Build base where clause with case-insensitive exact match on name
    const where: any = {
      name: { equals: name.trim(), mode: "insensitive" as const },
    };

    // Optional scoping by appointment type
    if (appointmentType && appointmentType.trim()) {
      where.appointmentType = {
        name: { equals: appointmentType.trim(), mode: "insensitive" as const },
      };
    } else if (appointmentTypeId) {
      const atId = parseInt(appointmentTypeId, 10);
      if (!Number.isNaN(atId)) {
        where.appointmentTypeId = atId;
      }
    }

    // Determine whether query can return multiple results
    const queryIsUnique = Boolean(where.appointmentType || where.appointmentTypeId);

    const include = {
      appointmentType: {
        select: { id: true, name: true },
      },
      _count: {
        select: { appointments: true },
      },
      ...(includeAppointments && {
        appointments: {
          orderBy: { appointmentDate: "asc" as const },
          include: {
            customer: {
              select: { id: true, name: true, whatsappNumber: true },
            },
          },
        },
      }),
    } as const;

    if (queryIsUnique) {
      const place = await prisma.appointmentPlace.findFirst({ where, include });
      if (!place) {
        return NextResponse.json(
          { error: "Appointment place not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(place);
    }

    // Without type scoping, return all matches (could be multiple types sharing same name)
    const places = await prisma.appointmentPlace.findMany({ where, include, orderBy: { name: "asc" } });

    if (!places || places.length === 0) {
      return NextResponse.json(
        { error: "Appointment place not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(places);
  } catch (error) {
    console.error("Error fetching appointment place by name:", error);
    return NextResponse.json(
      { error: "Failed to fetch appointment place" },
      { status: 500 }
    );
  }
}
