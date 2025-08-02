import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Helper function to parse the text items into structured data
function parseItems(textItems: string | string[]) {
  // If input is null or undefined, return empty array
  if (textItems == null) {
    console.warn('[parseItems] Received null or undefined input');
    return [];
  }

  // If it's a single item, convert it to an array for consistent processing
  const itemsArray = Array.isArray(textItems) ? textItems : [textItems];
  
  const result: { name: string; price: number; quantity: number; }[] = [];
  
  for (let itemStr of itemsArray) {
    // Skip non-string items
    if (typeof itemStr !== 'string') {
      console.warn(`[parseItems] Skipping non-string item:`, itemStr);
      continue;
    }
    
    // Clean the string first - remove any leading 'null,' (case insensitive) and trim
    itemStr = itemStr.replace(/^null\s*,\s*/i, '').trim();
    
    // Skip empty strings
    if (!itemStr) continue;
    
    // Split by comma to get individual items
    const items = itemStr.split(',')
      .map((i: string) => i.trim())
      .filter(Boolean);
    
    for (let item of items) {
      // Skip if item is empty after trimming
      if (!item) continue;
      
      // Match item name and price (e.g., "test item - 10")
      const match = item.match(/^(.+?)\s*-\s*(\d+(?:\.\d+)?)\s*$/);
      if (!match) {
        console.warn(`[parseItems] Could not parse item: "${item}"`);
        continue;
      }
      
      const name = match[1].trim();
      const price = parseFloat(match[2]);
      
      // Skip if price is not a valid number
      if (isNaN(price)) {
        console.warn(`[parseItems] Invalid price in item: "${item}"`);
        continue;
      }
      
      // Check if we already have this exact item (same name and price)
      const existingItem = result.find((i: any) => 
        i.name.toLowerCase() === name.toLowerCase() && 
        i.price === price
      );
      
      if (existingItem) {
        existingItem.quantity += 1;
      } else {
        result.push({ name, price, quantity: 1 });
      }
    }
  }
  
  console.log('[parseItems] Parsed items:', JSON.stringify(result, null, 2));
  return result;
}

// Calculate order totals
async function calculateTotals(items: Array<{ price: number; quantity: number }>, outletId: number) {
  // Get the outlet with its additional prices
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
    throw new Error('Outlet not found');
  }

  // Calculate subtotal
  const subtotal = items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);

  // Initialize fees and charges
  const fees: Array<{
    name: string;
    amount: number;
    type: 'fixed' | 'percentage';
    rate?: number;
    appliedTo?: 'subtotal' | 'total';
  }> = [];

  let serviceFee = 0;
  let vat = 0;
  let deliveryFee = 0;
  let total = subtotal;

  // Process each additional price
  for (const price of outlet.additionalPrices) {
    let amount = 0;
    
    if (price.type === 'percentage') {
      amount = subtotal * price.value.toNumber() / 100;
      
      // Check if this is VAT (5%)
      if (price.name.toLowerCase().includes('vat')) {
        vat = parseFloat(amount.toFixed(2));
      } 
      // Check if this is the service fee
      else if (price.name.toLowerCase().includes('service')) {
        serviceFee = parseFloat(amount.toFixed(2));
      } else {
        fees.push({
          name: price.name,
          amount: parseFloat(amount.toFixed(2)),
          type: 'percentage',
          rate: price.value.toNumber(),
          appliedTo: 'subtotal'
        });
      }
    } else {
      amount = price.value.toNumber();
      
      // Check if this is a delivery fee
      if (price.name.toLowerCase().includes('delivery')) {
        deliveryFee = parseFloat(amount.toFixed(2));
      }
      // Check if this is the service fee
      else if (price.name.toLowerCase().includes('service')) {
        serviceFee = parseFloat(amount.toFixed(2));
      } else {
        fees.push({
          name: price.name,
          amount: parseFloat(amount.toFixed(2)),
          type: 'fixed',
          appliedTo: 'subtotal'
        });
      }
    }
    
    // Add to total
    total += amount;
  }

  // If VAT wasn't explicitly set but is required, calculate it (5% of subtotal + service fee + delivery fee)
  if (vat === 0) {
    vat = parseFloat(((subtotal + serviceFee + deliveryFee) * 0.05).toFixed(2));
    total += vat;
  }

  // Prepare summary object
  const summary = {
    subtotal: parseFloat(subtotal.toFixed(2)),
    serviceFee: serviceFee,
    deliveryFee: deliveryFee,
    vat: vat,
    total: parseFloat(total.toFixed(2)),
    fees: fees
  };

  return {
    ...summary,
    outlet: {
      id: outlet.id,
      name: outlet.name,
      whatsappNo: outlet.whatsappNo,
      emirates: outlet.emirates ? {
        id: outlet.emirates.id,
        name: outlet.emirates.name,
        deliveryFee: deliveryFee
      } : null
    }
  };
}

// Helper function to generate a markdown notification message for the order
function generateOrderNotification(order: any) {
  // Format each order item
  const itemsList = order.items
    .map((item: any) => {
      const itemTotal = item.quantity * item.price;
      return `• ${item.quantity}x ${item.menuItem.name} - ${item.price.toFixed(2)} AED (${itemTotal.toFixed(2)} AED)`;
    })
    .join('\n');

  // Format the order summary
  const orderSummary = `
🆔 *Order #${order.id}*\n\n` +
    `📦 *Items:*\n${itemsList}\n\n` +
    `💵 *Order Summary*\n` +
    `Subtotal: ${order.subtotal.toFixed(2)} AED\n` +
    `Delivery Fee: ${order.deliveryFee.toFixed(2)} AED\n` +
    `Service Fee: ${order.serviceFee.toFixed(2)} AED\n` +
    `VAT (5%): ${order.vat.toFixed(2)} AED\n` +
    `*Total: ${order.total.toFixed(2)} AED*\n\n` +
    `📝 *Order Type:* ${order.orderType}\n` +
    `💳 *Payment Method:* ${order.paymentMethod}`;

  return orderSummary;
}

export async function POST(request: Request) {
  try {
    console.log('[ManyChats] Received order creation request');
    const requestData = await request.json();
    console.log('[ManyChats] Request data:', JSON.stringify(requestData, null, 2));

    const {
      customerId,
      emiratesId,
      orderType,
      category,
      outletId,
      deliveryAddress,
      deliveryLocation,
      buildingType,
      paymentMethod,
      note,
      textItems,
    } = requestData;

    if (!textItems) {
      console.error('[ManyChats] No items provided in the order');
      return NextResponse.json(
        { error: 'Items are required' },
        { status: 400 }
      );
    }

    console.log('[ManyChats] Parsing order items');
    const parsedItems = parseItems(textItems);
    
    if (!parsedItems.length) {
      console.error('[ManyChats] No valid items found in the order');
      return NextResponse.json(
        { error: 'No valid items found in the order' },
        { status: 400 }
      );
    }
    
    console.log('[ManyChats] Fetching menu items');
    const menuItems = await prisma.menuItem.findMany({
      where: {
        menu: {
          outletId: parseInt(outletId)
        }
      },
      include: {
        menu: true
      }
    });
    
    console.log(`[ManyChats] Found ${menuItems.length} menu items in outlet ${outletId}`);
    console.log('[ManyChats] Available menu items:', menuItems.map((mi: any) => ({
      id: mi.id,
      name: mi.name,
      price: mi.price,
      menuName: mi.menu.name
    })));

    // Map parsed items to menu items
    const orderItems: { menuItemId: number; quantity: number; price: number; menuItemName: string; }[] = [];
    for (const parsedItem of parsedItems) {
      // Find menu item by name (case-insensitive)
      const menuItem = menuItems.find((mi: any) => 
        mi.name.trim().toLowerCase() === parsedItem.name.trim().toLowerCase()
      );
      
      if (!menuItem) {
        console.error(`[ManyChats] Menu item not found: "${parsedItem.name}"`);
        console.error(`[ManyChats] Available items: ${menuItems.map((mi: any) => `"${mi.name}"`).join(', ')}`);
        return NextResponse.json(
          { 
            error: `Menu item not found: "${parsedItem.name}"`,
            availableItems: menuItems.map((mi: any) => ({
              id: mi.id,
              name: mi.name,
              price: mi.price
            }))
          },
          { status: 400 }
        );
      }
      
      // Use the price from the input, not from the database
      orderItems.push({
        menuItemId: menuItem.id,
        quantity: parsedItem.quantity,
        price: parsedItem.price,
        menuItemName: menuItem.name
      });
    }

    console.log('[ManyChats] Mapped order items:', JSON.stringify(orderItems, null, 2));

    // Calculate totals
    const { subtotal, serviceFee, deliveryFee, vat, total, fees } = await calculateTotals(
      orderItems.map((item: any) => ({
        price: item.price,
        quantity: item.quantity
      })),
      parseInt(outletId)
    );

    console.log('[ManyChats] Starting database transaction');
    // Create the order and items in a single transaction
    const [newOrder, createdItems] = await prisma.$transaction(async (tx) => {
      console.log('[ManyChats] Creating order record');
      
      // First create the order
      const order = await tx.order.create({
        data: {
          customer: { connect: { id: parseInt(customerId) } },
          emirates: { connect: { id: parseInt(emiratesId) } },
          orderType,
          category,
          outlet: { connect: { id: parseInt(outletId) } },
          deliveryAddress,
          deliveryLocation,
          buildingType,
          paymentMethod,
          note: note || '',
          status: 'PENDING',
          subtotal,
          serviceFee,
          deliveryFee,
          vat,
          total,
        },
        include: {
          customer: true,
          outlet: true,
          items: true
        }
      });

      console.log(`[ManyChats] Order created with ID: ${order.id}`);
      console.log('[ManyChats] Creating order items:', JSON.stringify(orderItems, null, 2));

      // Create order items in a batch
      await tx.orderItem.createMany({
        data: orderItems.map(item => ({
          orderId: order.id,
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          price: item.price,
        })),
        skipDuplicates: true,
      });

      // Fetch the created items with their menuItem relations
      const items = await tx.orderItem.findMany({
        where: { orderId: order.id },
        include: { menuItem: true }
      });

      console.log(`[ManyChats] Created ${items.length} order items`);
      
      return [order, items];
    }, {
      timeout: 30000, // 30 second timeout for the entire transaction
      maxWait: 20000, // 20 second max wait for the transaction to start
    });

    // Combine the results
    const orderWithItems = {
      ...newOrder,
      items: createdItems
    };

    console.log(`[ManyChats] Transaction completed for order ${orderWithItems.id}`);

    // Format the order items
    const orderItemsResponse = orderWithItems.items.map((item: any) => ({
      detail: `${item.menuItem.name} × ${item.quantity} - ${(Number(item.price) * Number(item.quantity)).toFixed(2)} AED`
    }));

    // Calculate item quantities for grouped items
    const groupedItems = orderItemsResponse.reduce((acc: any, item: any, index: number) => {
      // Since we're already grouping in the parseItems function, we can just use the items as is
      acc.push(item);
      return acc;
    }, []);

    // Prepare the structured response
    const response = {
      success: true,
      order: {
        id: orderWithItems.id,
        status: orderWithItems.status,
        orderType: orderWithItems.orderType,
        paymentMethod: orderWithItems.paymentMethod,
        createdAt: orderWithItems.createdAt,
        customer: {
          id: orderWithItems.customer.id,
          name: orderWithItems.customer.name,
          phone: orderWithItems.customer.whatsappNumber
        },
        outlet: {
          id: orderWithItems.outlet?.id,
          name: orderWithItems.outlet?.name,
          whatsappNo: orderWithItems.outlet?.whatsappNo
        },
        delivery: {
          address: orderWithItems.deliveryAddress,
          location: orderWithItems.deliveryLocation,
          buildingType: orderWithItems.buildingType
        },
        items: groupedItems,
        summary: {
          subtotal: `${orderWithItems.subtotal.toFixed(2)} AED`,
          serviceFee: orderWithItems.serviceFee ? `${orderWithItems.serviceFee.toFixed(2)} AED` : '0.00 AED',
          deliveryFee: orderWithItems.deliveryFee ? `${orderWithItems.deliveryFee.toFixed(2)} AED` : '0.00 AED',
          vat: orderWithItems.vat ? `${orderWithItems.vat.toFixed(2)} AED` : '0.00 AED',
          total: `${orderWithItems.total.toFixed(2)} AED`,
          fees: fees.map(fee => ({
            name: fee.name,
            amount: `${fee.amount.toFixed(2)} AED`,
            type: fee.type,
            ...(fee.rate && { rate: `${fee.rate}%` })
          }))
        },
        note: orderWithItems.note
      }
    };

    const notificationMessage = generateOrderNotification(orderWithItems);

    console.log(`[ManyChats] Order ${orderWithItems.id} created successfully`);
    return NextResponse.json({
      ...response,
      notification: {
        message: notificationMessage,
        orderId: orderWithItems.id,
        total: orderWithItems.total
      }
    });
    
  } catch (error) {
    console.error('[ManyChats] Error creating order:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create order',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
}
