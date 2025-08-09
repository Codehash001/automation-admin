import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Human-readable date formatter: e.g. "08th OCT 2025 - 09.30 PM"
function formatAppointmentDate(dateInput: string | Date): string {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return 'Invalid Date';
  const day = d.getDate();
  const month = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const year = d.getFullYear();
  const getSuffix = (n: number) => {
    const j = n % 10, k = n % 100;
    if (j === 1 && k !== 11) return 'st';
    if (j === 2 && k !== 12) return 'nd';
    if (j === 3 && k !== 13) return 'rd';
    return 'th';
  };
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  return `${String(day).padStart(2, '0')}${getSuffix(day)} ${month} ${year} - ${hh}.${mm} ${ampm}`;
}

// PUT /api/appointments/:id/status
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const idParam = params?.id;
    const id = parseInt(idParam, 10);
    if (!id || Number.isNaN(id)) {
      return NextResponse.json({ error: 'Valid appointment ID is required in the URL' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const { status } = body as { status?: string };

    if (!status || typeof status !== 'string') {
      return NextResponse.json({ error: 'status is required' }, { status: 400 });
    }

    const allowed = ['PENDING', 'SCHEDULED', 'COMPLETED', 'CANCELLED'];
    if (!allowed.includes(status)) {
      return NextResponse.json({ error: `Invalid status. Allowed: ${allowed.join(', ')}` }, { status: 400 });
    }

    // Ensure appointment exists
    const existing = await prisma.appointment.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: { status },
      include: {
        customer: { select: { id: true, name: true, whatsappNumber: true } },
        appointmentPlace: {
          include: { appointmentType: { select: { id: true, name: true } } },
        },
      },
    });

    return NextResponse.json({
      ...updated,
      appointmentDateFormatted: formatAppointmentDate(updated.appointmentDate as any),
    }, { status: 200 });
  } catch (error) {
    console.error('Error updating appointment status by URL id:', error);
    return NextResponse.json({ error: 'Failed to update appointment status' }, { status: 500 });
  }
}