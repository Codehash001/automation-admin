import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

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

// Helper function to combine duplicate items by name
function combineDuplicateItems(items: ProcessedItem[]): ProcessedItem[] {
  const itemMap = new Map<string, ProcessedItem>();
  
  items.forEach(item => {
    const existingItem = itemMap.get(item.name);
    if (existingItem) {
      existingItem.quantity += item.quantity;
      existingItem.total = Number((existingItem.price * existingItem.quantity).toFixed(2));
    } else {
      itemMap.set(item.name, { ...item });
    }
  });
  
  return Array.from(itemMap.values());
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

    // Combine duplicate items before processing
    processedItems = combineDuplicateItems(processedItems);

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

    // Get current date and time in UAE timezone
    const uaeTime = new Date().toLocaleString('en-AE', { 
      timeZone: 'Asia/Dubai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    // Build the invoice message with better formatting
    let message = `╔══════════════════════════╗\n`;
    message += `║        🛍️ INVOICE         ║\n`;
    message += `╚══════════════════════════╝\n\n`;
    
    message += `Order Type: *${orderType}*\n`;
    message += `Date: ${uaeTime}\n\n`;
    
    // Add items with better formatting
    message += `╔══════════════════════════════════════╗\n`;
    message += `║               ITEMS                  ║\n`;
    message += `╠══════════════════════════╦══════════╣\n`;
    
    processedItems.forEach(item => {
      const itemName = item.name.padEnd(25, ' ').substring(0, 25);
      const itemQty = `${item.quantity}x`.padStart(5, ' ');
      const itemTotal = formatCurrency(item.total).padStart(10, ' ');
      message += `║ ${itemName} ${itemQty} ${itemTotal} ║\n`;
    });
    
    message += `╠══════════════════════════╩══════════╣\n`;
    
    // Add subtotal
    const subtotalStr = formatCurrency(subtotal).padStart(10, ' ');
    message += `║ Subtotal:${' '.repeat(18)}${subtotalStr} ║\n`;
    
    // Add fees
    const applicableFees = fees.filter(fee => fee.applicable && fee.amount > 0);
    if (applicableFees.length > 0) {
      message += `╠══════════════════════════════════════╣\n`;
      message += `║           ADDITIONAL FEES             ║\n`;
      message += `╠══════════════════════════════════════╣\n`;
      
      applicableFees.forEach(fee => {
        const feeName = fee.name.padEnd(20, ' ');
        const feeAmount = formatCurrency(fee.amount).padStart(10, ' ');
        message += `║ ${feeName}${feeAmount} ║\n`;
      });
    }
    
    // Add total with double line
    message += `╠══════════════════════════════════════╣\n`;
    message += `║                                      ║\n`;
    const totalStr = formatCurrency(total).padStart(10, ' ');
    message += `║ *TOTAL:${' '.repeat(21)}${totalStr}* ║\n`;
    message += `╚══════════════════════════════════════╝\n\n`;
    
    message += `Thank you for your order!\n`;
    message += `Generated on: ${uaeTime}`;

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

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error generating invoice:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate invoice' },
      { status: 500 }
    );
  }
}
