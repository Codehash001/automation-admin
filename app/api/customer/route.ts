import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

type CustomerData = {
  name: string;
  whatsappNumber: string;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const whatsappNumber = searchParams.get('whatsappNumber');

    if (id) {
      const customer = await prisma.customer.findUnique({
        where: { id: parseInt(id) },
        include: {
          orders: true,
        },
      });
      return NextResponse.json(customer);
    }

    if (whatsappNumber) {
      // Remove any plus sign and spaces from the whatsapp number
      const cleanWhatsappNumber = whatsappNumber.replace(/\+?\s*/g, '');
      const customer = await prisma.customer.findFirst({
        where: { 
          whatsappNumber: {
            contains: cleanWhatsappNumber
          }
        },
        include: {
          orders: true,
        },
      });
      return NextResponse.json(customer);
    }

    const customers = await prisma.customer.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { orders: true },
        },
      },
    });
    return NextResponse.json(customers);
  } catch (error) {
    console.error('Error fetching customers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customers' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const data: CustomerData = await request.json();
    
    // Check if customer with this whatsapp number already exists
    const existingCustomer = await prisma.customer.findUnique({
      where: { whatsappNumber: data.whatsappNumber },
    });

    if (existingCustomer) {
      return NextResponse.json(
        { error: 'A customer with this WhatsApp number already exists' },
        { status: 400 }
      );
    }

    const customer = await prisma.customer.create({
      data: {
        name: data.name,
        whatsappNumber: data.whatsappNumber,
      },
    });

    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    console.error('Error creating customer:', error);
    return NextResponse.json(
      { error: 'Failed to create customer' },
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
        { error: 'Customer ID is required' },
        { status: 400 }
      );
    }

    const data: Partial<CustomerData> = await request.json();
    
    // Check if customer exists
    const existingCustomer = await prisma.customer.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingCustomer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Check if whatsapp number is being updated to an existing one
    if (data.whatsappNumber && data.whatsappNumber !== existingCustomer.whatsappNumber) {
      const numberExists = await prisma.customer.findUnique({
        where: { whatsappNumber: data.whatsappNumber },
      });

      if (numberExists) {
        return NextResponse.json(
          { error: 'A customer with this WhatsApp number already exists' },
          { status: 400 }
        );
      }
    }

    const updatedCustomer = await prisma.customer.update({
      where: { id: parseInt(id) },
      data: {
        name: data.name,
        whatsappNumber: data.whatsappNumber,
      },
    });

    return NextResponse.json(updatedCustomer);
  } catch (error) {
    console.error('Error updating customer:', error);
    return NextResponse.json(
      { error: 'Failed to update customer' },
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
        { error: 'Customer ID is required' },
        { status: 400 }
      );
    }

    // Check if customer exists
    const existingCustomer = await prisma.customer.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingCustomer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    await prisma.customer.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    console.error('Error deleting customer:', error);
    return NextResponse.json(
      { error: 'Failed to delete customer' },
      { status: 500 }
    );
  }
}
