import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import twilio from 'twilio';

// Initialize Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

interface ProcessedItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  total: number;
}

interface GenerateInvoiceRequest {
  items: string | string[];
  orderType: 'Delivery' | 'Pickup';
  customerPhoneNumber?: string;  // Customer's WhatsApp number to send the invoice to
}

interface InvoiceResponse {
  success: boolean;
  message?: string;
  error?: string;
  invoice?: any;
  whatsappMessageSid?: string;  // Twilio message SID if sent
}

// Helper function to parse item string like "null,Idly Samber - 10 AED"
function parseItemString(itemString: string): { name: string; price: number } {
  // Remove the leading "null," if present
  const cleanString = itemString.replace(/^null\s*,\s*/, '');
  
  // Match the price at the end of the string (digits with optional decimal point)
  const priceMatch = cleanString.match(/(\d+(?:\.\d+)?)\s*(?:AED)?\s*$/);
  
  let name = cleanString.trim();
  let price = 0;
  
  if (priceMatch) {
    price = parseFloat(priceMatch[1]);
    // Remove the price part from the name
    name = cleanString.substring(0, priceMatch.index).trim();
    // Remove any trailing dash or spaces
    name = name.replace(/[\s-]+$/, '').trim();
  }
  
  return { name, price };
}

// Function to split and parse multiple items from a single string
function parseItemsString(itemsString: string): ProcessedItem[] {
  // Split by newlines or commas, then filter out empty strings and null items
  const itemStrings = itemsString
    .split(/[\n,]+/)
    .map(s => s.trim())
    .filter(s => {
      // Remove empty strings and items that are just "null"
      return Boolean(s) && s.toLowerCase() !== 'null';
    });

  return itemStrings.map((itemStr, index) => {
    const { name, price } = parseItemString(itemStr);
    // Skip items with no valid name or price
    if (!name || price <= 0) return null;
    
    return {
      menuItemId: `item-${index}`,
      name,
      price,
      quantity: 1,
      total: price
    };
  }).filter(Boolean) as ProcessedItem[]; // Filter out any null items
}

// Helper function to format currency
const formatCurrency = (amount: number): string => {
  return amount.toFixed(2) + ' AED';
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { items: rawItems, orderType, customerPhoneNumber } = body as GenerateInvoiceRequest;
    let processedItems: ProcessedItem[] = [];

    // Handle different input formats
    if (typeof rawItems === 'string') {
      // Single string input - parse it into multiple items
      processedItems = parseItemsString(rawItems);
    } else if (Array.isArray(rawItems)) {
      // Array of strings - process each one
      processedItems = rawItems.flatMap((item, index) => {
        if (typeof item === 'string') {
          // Skip empty strings or "null" items
          if (!item.trim() || item.trim().toLowerCase() === 'null') {
            return [];
          }
          const { name, price } = parseItemString(item);
          // Skip items with no valid name or price
          if (!name || price <= 0) return [];
          
          return {
            menuItemId: `item-${index}`,
            name,
            price,
            quantity: 1,
            total: price
          };
        }
        return [];
      });
    }

    // Validate we have at least one valid item
    if (processedItems.length === 0) {
      return NextResponse.json(
        { 
          success: false,
          error: 'No valid items found in the input'
        },
        { status: 400 }
      );
    }

    // Get all active additional prices
    const additionalPrices = await prisma.additionalPrice.findMany({
      where: { isActive: true }
    });

    const subtotal = Number(
      processedItems
        .reduce((sum, item) => sum + (item.total || 0), 0)
        .toFixed(2)
    );

    // Calculate additional fees
    const fees = additionalPrices.map(price => {
      let amount = 0;
      
      switch(price.name.toLowerCase()) {
        case 'delivery':
          amount = orderType === 'Delivery' ? Number(price.value) : 0;
          break;
        case 'vat':
        case 'tax':
          amount = Number(((subtotal * Number(price.value)) / 100).toFixed(2));
          break;
        default:
          amount = Number(price.value);
      }
      
      return {
        id: price.id,
        name: price.name,
        amount,
        type: price.type,
        applicable: amount > 0
      };
    });

    const totalFees = Number(
      fees
        .filter(fee => fee.applicable)
        .reduce((sum, fee) => sum + fee.amount, 0)
        .toFixed(2)
    );
    
    const total = Number((subtotal + totalFees).toFixed(2));

    // Build the invoice message
    let message = `*🛍️ Order Invoice*\n`;
    message += `Order Type: *${orderType}*\n\n`;
    
    // Add items
    message += '*Items:*\n';
    processedItems.forEach(item => {
      message += `• ${item.name} (${item.quantity}x ${formatCurrency(item.price)})\n`;
    });
    
    // Add subtotal
    message += `\n*Subtotal:* ${formatCurrency(subtotal)}\n`;
    
    // Add fees
    const applicableFees = fees.filter(fee => fee.applicable && fee.amount > 0);
    if (applicableFees.length > 0) {
      message += '\n*Additional Fees:*\n';
      applicableFees.forEach(fee => {
        message += `• ${fee.name}: ${formatCurrency(fee.amount)}\n`;
      });
    }
    
    // Add total
    message += `\n*Total Amount: ${formatCurrency(total)}*`;
    
    // Add timestamp
    const now = new Date();
    message += `\n\n_Generated on ${now.toLocaleDateString()} at ${now.toLocaleTimeString()}_`;

    // Prepare the response
    const response: InvoiceResponse = {
      success: true,
      message,
      invoice: {
        items: processedItems.map(item => ({
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.price,
          total: item.total
        })),
        subtotal,
        fees: applicableFees.map(fee => ({
          name: fee.name,
          amount: fee.amount
        })),
        total,
        orderType
      }
    };

    // Send the invoice via WhatsApp if phone number is provided
    if (customerPhoneNumber) {
      try {
        // Format the phone number to E.164 format if needed
        const formattedNumber = customerPhoneNumber.startsWith('+') 
          ? customerPhoneNumber 
          : `+${customerPhoneNumber.replace(/^\+/, '')}`;
        
        const whatsappMessage = await twilioClient.messages.create({
          body: message.replace(/\n/g, '\n'), // Ensure proper line breaks
          from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
          to: `whatsapp:${formattedNumber}`
        });
        
        response.whatsappMessageSid = whatsappMessage.sid;
      } catch (twilioError) {
        console.error('Error sending WhatsApp message:', twilioError);
        // Don't fail the request, just log the error and continue
        response.error = 'Invoice generated but failed to send via WhatsApp';
      }
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error generating invoice:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to generate invoice',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
