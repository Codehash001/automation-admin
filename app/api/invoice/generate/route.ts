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
  category?: 'FOOD' | 'GROCERY' | 'MEDICINE';
  outletId?: number;         // For FOOD
  groceryStoreId?: number;   // For GROCERY
  medicalStoreId?: number;   // For MEDICINE
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

    const {
      items: rawItems,
      orderType,
      customerPhoneNumber,
      outletId: rawOutletId,
      groceryStoreId: rawGroceryId,
      medicalStoreId: rawMedicalId,
      category: rawCategory,
    } = body as GenerateInvoiceRequest;

    // Parse IDs safely (they may arrive as strings)
    const outletId = rawOutletId !== undefined ? Number(rawOutletId) : undefined;
    const groceryStoreId = rawGroceryId !== undefined ? Number(rawGroceryId) : undefined;
    const medicalStoreId = rawMedicalId !== undefined ? Number(rawMedicalId) : undefined;

    // Backward compatibility: if only outletId is provided with no category, assume FOOD
    const category = (rawCategory || (typeof outletId === 'number' && !isNaN(outletId) ? 'FOOD' : undefined)) as
      | 'FOOD'
      | 'GROCERY'
      | 'MEDICINE'
      | undefined;

    // Validate category/IDs
    const idsProvided = [outletId, groceryStoreId, medicalStoreId].filter(
      (v) => typeof v === 'number' && !isNaN(v as number)
    );

    if (!category) {
      return NextResponse.json(
        { success: false, error: 'category is required (FOOD | GROCERY | MEDICINE) or provide outletId to default to FOOD' },
        { status: 400 }
      );
    }

    if (idsProvided.length !== 1) {
      return NextResponse.json(
        { success: false, error: 'Provide exactly one of outletId, groceryStoreId, or medicalStoreId' },
        { status: 400 }
      );
    }

    if (category === 'FOOD' && typeof outletId !== 'number') {
      return NextResponse.json(
        { success: false, error: 'For category FOOD you must provide outletId' },
        { status: 400 }
      );
    }
    if (category === 'GROCERY' && typeof groceryStoreId !== 'number') {
      return NextResponse.json(
        { success: false, error: 'For category GROCERY you must provide groceryStoreId' },
        { status: 400 }
      );
    }
    if (category === 'MEDICINE' && typeof medicalStoreId !== 'number') {
      return NextResponse.json(
        { success: false, error: 'For category MEDICINE you must provide medicalStoreId' },
        { status: 400 }
      );
    }

    // Fetch the correct store entity and its active additional prices
    let store: any = null;
    if (category === 'FOOD') {
      store = await prisma.outlet.findUnique({
        where: { id: outletId as number },
        include: {
          additionalPrices: { where: { isActive: true } },
          emirates: true,
        },
      });
    } else if (category === 'GROCERY') {
      store = await prisma.groceryStore.findUnique({
        where: { id: groceryStoreId as number },
        include: {
          additionalPrices: { where: { isActive: true } },
          emirates: true,
        },
      });
    } else if (category === 'MEDICINE') {
      store = await prisma.medicalStore.findUnique({
        where: { id: medicalStoreId as number },
        include: {
          additionalPrices: { where: { isActive: true } },
          emirates: true,
        },
      });
    }

    if (!store) {
      return NextResponse.json(
        { success: false, error: 'Store not found' },
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

    // Use the additional prices from the store instead of fetching all
    const additionalPrices = store.additionalPrices;

    const subtotal = Number(
      processedItems
        .reduce((sum: number, item: any) => sum + (item.total || 0), 0)
        .toFixed(2)
    );

    // Calculate additional fees
    // Pass 1: compute base fees (exclude VAT/TAX here to avoid self-reference)
    const baseFees = additionalPrices.map((price: any) => {
      const nameLower = String(price.name || '').toLowerCase();
      let amount = 0;
      
      if (nameLower.includes('delivery')) {
        amount = orderType === 'Delivery' ? Number(price.value) : 0;
      } else if (nameLower.includes('vat') || nameLower.includes('tax')) {
        // handled in pass 2
        amount = 0;
      } else if (nameLower.includes('service')) {
        amount = Number(price.value);
      } else {
        amount = Number(price.value);
      }
      
      return {
        id: price.id,
        name: price.name,
        amount: Number(isNaN(amount) ? 0 : amount),
        type: price.type,
        applicable: Number(isNaN(amount) ? 0 : amount) > 0
      };
    });

    // Gather values needed for VAT/TAX calculation
    const serviceFeeAmount = baseFees.find((f: any) => String(f.name || '').toLowerCase().includes('service'))?.amount || 0;
    const deliveryFeeAmount = baseFees.find((f: any) => String(f.name || '').toLowerCase().includes('delivery'))?.amount || 0;

    // Pass 2: compute VAT/TAX based on base fee amounts
    const vatFees = additionalPrices
      .filter((price: any) => {
        const nameLower = String(price.name || '').toLowerCase();
        return nameLower.includes('vat') || nameLower.includes('tax');
      })
      .map((price: any) => {
        const percentage = Number(price.value) || 0;
        const taxableBase = serviceFeeAmount + deliveryFeeAmount;
        const amount = Number(((taxableBase * percentage) / 100).toFixed(2));
        return {
          id: price.id,
          name: price.name,
          amount,
          type: price.type,
          applicable: amount > 0
        };
      });

    const fees = [...baseFees, ...vatFees];

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
    message += `----------------------------`;

    message += `\n`;
    
    // Add applicable fees
    const applicableFees = fees.filter((fee: any) => fee.applicable && fee.amount > 0);
    applicableFees.forEach((fee: any) => {
      message += `${fee.name}: ${formatCurrency(fee.amount)}\n`;
    });
    message += `----------------------------`;
    message += `\n\n`;
    message += `----------------------------`;

    message += `\n`;
    // Add total
    message += `*Total: ${formatCurrency(total)}*`;
    message += `\n`;
    message += `____________________________`;
    message += `\n`;
    message += `____________________________`;

    // Prepare the response
    const response: InvoiceResponse = {
      success: true,
      message,
      invoice: {
        items: processedItems.map((item: any) => ({
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.price,
          total: item.total,
        })),
        subtotal,
        fees: applicableFees.map((fee: any) => ({
          name: fee.name,
          amount: fee.amount,
        })),
        total,
        orderType,
        date: uaeTime,
        category,
        // Maintain existing field name for backward compatibility
        outlet: {
          id: store.id,
          name: store.name,
          emirate: store.emirates?.name || 'UAE',
        },
      },
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
