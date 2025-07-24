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
  outletId?: number;  // Outlet ID for the order
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
    .map((s: string) => s.trim())
    .filter((s: string) => {
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
  
  items.forEach((item: any) => {
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

    const { items: rawItems, orderType, customerPhoneNumber, outletId } = body as GenerateInvoiceRequest;
    
    // Validate outletId is provided
    if (!outletId) {
      return NextResponse.json(
        { success: false, error: 'Outlet ID is required' },
        { status: 400 }
      );
    }

    // Verify the outlet exists
    const outlet = await prisma.outlet.findUnique({
      where: { id: outletId },
      include: {
        additionalPrices: {
          where: { isActive: true }
        },
        emirates: true
      }
    });

    if (!outlet) {
      return NextResponse.json(
        { success: false, error: 'Outlet not found' },
        { status: 404 }
      );
    }

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

    // Use the additional prices from the outlet instead of fetching all
    const additionalPrices = outlet.additionalPrices;

    const subtotal = Number(
      processedItems
        .reduce((sum: number, item: any) => sum + (item.total || 0), 0)
        .toFixed(2)
    );

    // Calculate additional fees
    const fees = additionalPrices.map((price: any) => {
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
        .filter((fee: any) => fee.applicable)
        .reduce((sum: number, fee: any) => sum + fee.amount, 0)
        .toFixed(2)
    );
    
    const total = Number((subtotal + totalFees).toFixed(2));

    // Get current UAE time
    const uaeTime = new Date().toLocaleString('en-AE', { 
      timeZone: 'Asia/Dubai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    // Build the simplified invoice message
    let message = `*ORDER SUMMARY*\n`;
    message += `${uaeTime} • ${orderType}\n\n`;
    
    // Add items
    message += `*Items:*\n`;
    processedItems.forEach(item => {
      message += `• ${item.name} × ${item.quantity} - ${formatCurrency(item.total)}\n`;
    });
    
    message += `\n`;
    
    // Add subtotal
    message += `Subtotal: ${formatCurrency(subtotal)}\n`;
    message += `--------------------`;

    message += `\n`;
    
    // Add applicable fees
    const applicableFees = fees.filter((fee: any) => fee.applicable && fee.amount > 0);
    applicableFees.forEach((fee: any) => {
      message += `${fee.name}: ${formatCurrency(fee.amount)}\n`;
    });
    message += `--------------------`;
    message += `\n\n`;
    message += `--------------------`;

    
    // Add total
    message += `*Total: ${formatCurrency(total)}*`;
    message += `____________________`;

    // Prepare the response
    const response: InvoiceResponse = {
      success: true,
      message,
      invoice: {
        items: processedItems.map((item: any) => ({
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.price,
          total: item.total
        })),
        subtotal,
        fees: applicableFees.map((fee: any) => ({
          name: fee.name,
          amount: fee.amount
        })),
        total,
        orderType,
        date: uaeTime,
        outlet: {
          id: outlet.id,
          name: outlet.name,
          emirate: outlet.emirates?.name || 'UAE'
        }
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
