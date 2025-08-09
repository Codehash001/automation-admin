import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error('Error updating appointment status by URL id:', error);
    return NextResponse.json({ error: 'Failed to update appointment status' }, { status: 500 });
  }
}