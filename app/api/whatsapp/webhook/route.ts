import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { OrderStatus } from '@prisma/client';
import twilio from 'twilio';

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Define the expected webhook payload type
interface TwilioWebhookPayload {
  Body?: string;
  From?: string;
  MessageSid?: string;
  [key: string]: string | undefined;
}

// Helper function to send WhatsApp message
async function sendMessage(to: string, body: string) {
  try {
    await twilioClient.messages.create({
      body,
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
      to: `whatsapp:${to}`
    });
    return true;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    
    // Convert FormData to a plain object
    const body = Array.from(formData.entries()).reduce((acc, [key, value]) => {
      acc[key] = value.toString();
      return acc;
    }, {} as Record<string, string>);
    
    const payload = body as unknown as TwilioWebhookPayload;
    const from = payload.From?.replace('whatsapp:', '') || '';
    const messageBody = (payload.Body || '').trim();
    
    if (!from) {
      console.error('No sender information');
      return NextResponse.json({ status: 'error', message: 'No sender' });
    }

    // Get the last order for this outlet that's in PENDING status
    const order = await prisma.order.findFirst({
      where: { 
        outlet: { whatsappNo: from },
        status: OrderStatus.PENDING
      },
      orderBy: { createdAt: 'desc' },
      include: { customer: true }
    });

    if (!order) {
      console.error('No pending order found for outlet:', from);
      await sendMessage(from, '❌ No pending orders found.');
      return NextResponse.json({ status: 'error', message: 'No pending order' });
    }

    // Handle the response
    if (messageBody === '1' || messageBody.toLowerCase().includes('accept')) {
      // Accept order
      await prisma.order.update({
        where: { id: order.id },
        data: { 
          status: OrderStatus.PREPARING,
          updatedAt: new Date()
        }
      });

      // Notify outlet
      await sendMessage(from, `✅ Order #${order.id} has been accepted and is now time to prepare.`);
      
      // Notify customer
      try {
        await sendMessage(
          order.customer.whatsappNumber,
          `✅ *Order Accepted*\n\n` +
          `Your order #${order.id} has been accepted and is now being prepared.\n\n` +
          `*Order Summary*:\n` +
          `- Status: Preparing\n` +
          `- Estimated Time: 30-45 minutes\n\n` +
          `We'll notify you once your order is ready for ${order.orderType === 'Delivery' ? 'delivery' : 'pickup'}.`
        );
      } catch (error) {
        console.error('Failed to notify customer:', error);
      }
      
    } else if (messageBody === '2' || messageBody.toLowerCase().includes('decline')) {
      // Ask for decline reason
      await sendMessage(
        from,
        `❓ Please specify a reason for declining order #${order.id}:\n\n` +
        `1. Out of stock\n` +
        `2. Too busy\n` +
        `3. Closed\n\n` +
        `Reply with the number of your choice.`
      );
    } 
    // Handle decline reasons (1, 2, or 3 after declining)
    else if (['1', '2', '3'].includes(messageBody) && 
             order.status === OrderStatus.PENDING) {
      
      const reasons = {
        '1': 'items are out of stock',
        '2': 'we are currently too busy',
        '3': 'we are currently closed'
      };
      
      const reasonText = reasons[messageBody as keyof typeof reasons] || 'we are unable to fulfill your order';
      
      // Update order status
      await prisma.order.update({
        where: { id: order.id },
        data: { 
          status: OrderStatus.DECLINED,
          statusReason: reasonText,
          updatedAt: new Date()
        }
      });

      // Notify outlet
      await sendMessage(
        from,
        `❌ Order #${order.id} has been declined. Reason: ${reasonText}`
      );
      
      // Notify customer about decline
      try {
        await sendMessage(
          order.customer.whatsappNumber,
          `❌ *Order Update*\n\n` +
          `We're sorry, but your order #${order.id} has been declined.\n\n` +
          `*Reason*: ${reasonText.charAt(0).toUpperCase() + reasonText.slice(1)}\n\n` +
          `Please try ordering again later or contact support if you need assistance.`
        );
      } catch (error) {
        console.error('Failed to notify customer about decline:', error);
      }
    } else {
      // Invalid response
      await sendMessage(
        from,
        `❌ Invalid response. Please reply with:\n` +
        `1 - To accept the order\n` +
        `2 - To decline the order`
      );
    }

    return NextResponse.json({ status: 'success' });
  } catch (error) {
    console.error('Error in WhatsApp webhook:', error);
    return NextResponse.json(
      { status: 'error', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
