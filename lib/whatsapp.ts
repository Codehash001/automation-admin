import twilio from 'twilio';
import prisma from './prisma';
import { OrderStatus } from '@prisma/client';

// Initialize Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Types remain the same as before
interface OrderItem {
  menuItem: {
    name: string;
  };
  quantity: number;
  price: number | { toNumber: () => number };
}

interface OrderDetails {
  id: number;
  orderType: string;
  category: string;
  deliveryAddress?: string | null;
  deliveryLocation?: string | null;
  buildingType?: string | null;
  paymentMethod: string;
  note?: string | null;
  customer: {
    name: string;
    phone: string;
  };
  outlet: {
    whatsappNo: string;
    name: string;
  };
  items: OrderItem[];
  total: number | { toNumber: () => number };
}

// Helper to safely convert Prisma Decimal to number
const toNumber = (value: number | { toNumber: () => number } | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  return typeof value === 'number' ? value : value.toNumber();
};

/**
 * Formats a phone number to E.164 format required by Twilio
 * @param phone The phone number to format
 * @returns Formatted phone number in E.164 format
 */
const formatPhoneNumber = (phone: string): string => {
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');
  
  // If the number starts with a 0, replace with country code (assuming UAE)
  if (cleaned.startsWith('0')) {
    return `+971${cleaned.substring(1)}`;
  }
  
  // If the number doesn't start with +, add it
  if (!cleaned.startsWith('+')) {
    return `+${cleaned}`;
  }
  
  return cleaned;
};

// Helper function to add delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function sendOrderNotificationToOutlet(orderId: number): Promise<boolean> {
  try {
    // Get order details with customer and outlet information
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        outlet: true,
        items: {
          include: {
            menuItem: true
          }
        }
      }
    });

    if (!order) {
      console.error(`[WhatsApp] Order ${orderId} not found`);
      return false;
    }

    const outletNumber = order.outlet?.whatsappNo;
    if (!outletNumber) {
      console.error(`[WhatsApp] No WhatsApp number found for outlet ${order.outlet?.id}`);
      return false;
    }

    // Format order items
    const itemsList = order.items
      .map(item => `• ${item.quantity}x ${item.menuItem.name} - $${Number(item.price).toFixed(2)}`)
      .join('\n');

    // Calculate subtotal
    const subtotal = order.items.reduce((sum: number, item: any) => 
      sum + (Number(item.price) * item.quantity), 0);

    // Format the main order message
    const orderMessage = `
🆕 *New Order #${order.id}*

👤 *Customer*: ${order.customer.name}
📱 *Phone*: ${order.customer.whatsappNumber}

📋 *Order Items*:
${itemsList}

💵 *Subtotal*: $${subtotal.toFixed(2)}
🛵 *Delivery Fee*: $${Number(order.deliveryFee).toFixed(2)}
💳 *Total*: $${Number(order.total).toFixed(2)}

📍 *Delivery Address*: ${order.deliveryAddress || 'N/A'}
🏢 *Building Type*: ${order.buildingType || 'Not specified'}
📝 *Note*: ${order.note || 'No notes'}
    `.trim();

    try {
      // Send the order details message
      console.log(`[WhatsApp] Sending order details for order #${order.id} to ${outletNumber}`);
      await twilioClient.messages.create({
        body: orderMessage,
        from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
        to: `whatsapp:${outletNumber}`
      });
      console.log(`[WhatsApp] Order details sent successfully for order #${order.id}`);
      
      // Add a small delay before sending the next message
      await delay(1000);

      // If there's a delivery location, send it as a separate message
      if (order.deliveryLocation) {
        try {
          console.log(`[WhatsApp] Sending location for order #${order.id}`);
          const [lat, lng] = order.deliveryLocation.split(',').map(Number);
          await twilioClient.messages.create({
            body: `📍 *Delivery Location for Order #${order.id}*`,
            from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
            to: `whatsapp:${outletNumber}`,
            persistentAction: [`geo:${lat},${lng}|${order.deliveryAddress || 'Delivery Location'}`]
          });
          console.log(`[WhatsApp] Location sent successfully for order #${order.id}`);
          
          // Add a small delay before sending the action message
          await delay(1000);
        } catch (locationError) {
          console.error(`[WhatsApp] Error sending location for order #${order.id}:`, locationError);
          // Continue even if location fails
        }
      }

      // Send the action message after the location
      const actionMessage = `
📝 *How would you like to proceed with Order #${order.id}?*

Please reply with the number of your choice:
1️⃣ *1* - Accept Order
2️⃣ *2* - Decline Order

Example: Reply with "1" to accept or "2" to decline.
      `.trim();

      console.log(`[WhatsApp] Sending action message for order #${order.id}`);
      const actionMessageResponse = await twilioClient.messages.create({
        body: actionMessage,
        from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
        to: `whatsapp:${outletNumber}`
      });
      
      console.log(`[WhatsApp] Action message sent successfully for order #${order.id}`, {
        messageSid: actionMessageResponse.sid,
        status: actionMessageResponse.status
      });

      return true;
      
    } catch (error: any) {
      console.error(`[WhatsApp] Error sending messages for order #${order.id}:`, {
        error: error.message,
        code: error.code,
        status: error.status,
        moreInfo: error.moreInfo
      });
      return false;
    }
    
  } catch (error) {
    console.error('[WhatsApp] Error in sendOrderNotificationToOutlet:', error);
    return false;
  }
}

// Update order status with proper typing
async function updateOrderStatus(
  orderId: number, 
  status: OrderStatus, 
  reason?: string
): Promise<boolean> {
  try {
    await prisma.order.update({
      where: { id: orderId },
      data: { 
        status,
        ...(reason && { statusReason: reason }),
        updatedAt: new Date()
      }
    });
    return true;
  } catch (error) {
    console.error(`Error updating order ${orderId} status to ${status}:`, error);
    return false;
  }
}

// Placeholder for delivery rider assignment
async function findDeliveryRider(orderId: number) {
  console.log(`[Delivery] Finding rider for order ${orderId}`);
  // TODO: Implement delivery rider assignment logic
  // This will be implemented in a future update
}
