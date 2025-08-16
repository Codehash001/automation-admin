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
async function calculateTotals(
  items: Array<{ price: number; quantity: number }>,
  additionalPrices: any[],
  orderType: string
) {
  // Calculate subtotal
  const subtotal = items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);

  let serviceFee = 0;
  let deliveryFee = 0;
  let vat = 0;
  const fees: Array<{ name: string; amount: number; type: 'fixed' | 'percentage'; rate?: number }> = [];
  const vatRates: number[] = [];

  let total = subtotal;

  // Process each additional price
  for (const price of additionalPrices) {
    const nameLower = String(price.name || '').toLowerCase();
    let amount = 0;

    // Collect VAT/TAX percentage rates; compute after other fees
    if (nameLower.includes('vat') || nameLower.includes('tax')) {
      if (price.type === 'percentage' && Number.isFinite(Number(price.value))) {
        vatRates.push(Number(price.value));
      }
      continue; // do not compute now; compute after fees base is known
    }

    // Apply Delivery fee only for Delivery orders
    if (nameLower.includes('delivery') && String(orderType).toLowerCase() !== 'delivery') {
      amount = 0;
    } else if (price.type === 'percentage') {
      // Percentage fees apply on subtotal only, NOT including any other fees
      amount = subtotal * (Number(price.value) / 100);
    } else {
      // Fixed fees
      amount = Number(price.value);
    }

    // Add to total and track by type
    if (amount > 0) {
      total += amount;
    }

    if (nameLower.includes('delivery')) {
      deliveryFee += amount;
    } else if (nameLower.includes('service')) {
      serviceFee += amount;
    }

    fees.push({ name: price.name, amount, type: price.type });
  }

  // Compute VAT on fees only (exclude subtotal)
  const isDelivery = String(orderType || '').toLowerCase() === 'delivery';
  const vatBase = isDelivery ? (serviceFee + deliveryFee) : serviceFee; // Self Pick-up -> only service fee
  for (const rate of vatRates) {
    const vatPart = vatBase * (rate / 100);
    vat += vatPart;
    fees.push({ name: `VAT ${rate}%`, amount: vatPart, type: 'percentage', rate });
  }
  total += vat;

  const summary = {
    subtotal,
    serviceFee,
    deliveryFee,
    vat,
    total,
    fees
  };

  return summary;
}

// Helper function to generate a markdown notification message for the order
function generateOrderNotification(order: any) {
  // Format each order item (support food/grocery/medicine)
  const itemsList = (order.items || [])
    .map((item: any) => {
      const itemTotal = Number(item.quantity) * Number(item.price);
      const itemName = item?.menuItem?.name || item?.groceryMenuItem?.name || item?.medicineMenuItem?.name || item?.menuItemName || 'Item';
      return `• ${item.quantity}x ${itemName} - ${Number(item.price).toFixed(2)} AED (${itemTotal.toFixed(2)} AED)`;
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
    const categoryLower = String(category || 'food').toLowerCase();
    let availableMenuItems: Array<{ id: number; name: string; price: number; menuName?: string }>; 
    if (categoryLower === 'grocery') {
      const items = await prisma.groceryMenuItem.findMany({
        where: { menu: { storeId: Number(outletId) }, isAvailable: true },
        include: { menu: true }
      });
      availableMenuItems = items.map(i => ({ id: i.id, name: i.name, price: Number(i.price), menuName: i.menu?.name }));
      console.log(`[ManyChats] Found ${availableMenuItems.length} grocery menu items in store ${outletId}`);
    } else if (categoryLower === 'medicine' || categoryLower === 'medical') {
      const items = await prisma.medicineMenuItem.findMany({
        where: { menu: { storeId: Number(outletId) }, isAvailable: true },
        include: { menu: true }
      });
      availableMenuItems = items.map(i => ({ id: i.id, name: i.name, price: Number(i.price), menuName: i.menu?.name }));
      console.log(`[ManyChats] Found ${availableMenuItems.length} medicine menu items in store ${outletId}`);
    } else {
      const items = await prisma.menuItem.findMany({
        where: { menu: { outletId: Number(outletId) }, isAvailable: true },
        include: { menu: true }
      });
      availableMenuItems = items.map(i => ({ id: i.id, name: i.name, price: Number(i.price), menuName: i.menu?.name }));
      console.log(`[ManyChats] Found ${availableMenuItems.length} food menu items in outlet ${outletId}`);
    }
    console.log('[ManyChats] Available menu items:', availableMenuItems.map(mi => ({ id: mi.id, name: mi.name, price: mi.price, menuName: mi.menuName })));

    // Map parsed items to menu items
    const orderItems: { menuItemId: number; quantity: number; price: number; menuItemName: string; }[] = [];
    for (const parsedItem of parsedItems) {
      const queryName = parsedItem.name.trim().toLowerCase();
      const matchedItem = availableMenuItems.find(mi => mi.name.trim().toLowerCase() === queryName);
      if (!matchedItem) {
        console.log(`[ManyChats] Menu item not found: "${parsedItem.name}"`);
        console.log('[ManyChats] Available items:', availableMenuItems.map(mi => `"${mi.name}"`).join(', '));
        return NextResponse.json({
          error: `Menu item not found: ${parsedItem.name}`,
          availableItems: availableMenuItems.map(mi => mi.name)
        }, { status: 400 });
      }
      
      // Use the price from the input, not from the database
      if (categoryLower === 'grocery') {
        orderItems.push({
          groceryMenuItemId: matchedItem.id,
          quantity: parsedItem.quantity,
          price: parsedItem.price,
          menuItemName: matchedItem.name
        } as any);
      } else if (categoryLower === 'medicine' || categoryLower === 'medical') {
        orderItems.push({
          medicineMenuItemId: matchedItem.id,
          quantity: parsedItem.quantity,
          price: parsedItem.price,
          menuItemName: matchedItem.name
        } as any);
      } else {
        orderItems.push({
          menuItemId: matchedItem.id,
          quantity: parsedItem.quantity,
          price: parsedItem.price,
          menuItemName: matchedItem.name
        });
      }
    }

    console.log('[ManyChats] Mapped order items:', JSON.stringify(orderItems, null, 2));

    // Resolve outlet/store context and additional prices
    let outletRecord: any = null;
    let additionalPrices: any[] = [];
    let orderOutletFK: Record<string, any> = {};

    if (!outletId || isNaN(Number(outletId))) {
      return NextResponse.json({ error: 'Invalid or missing outletId' }, { status: 400 });
    }

    if (categoryLower === 'grocery') {
      // Load Grocery Store and its active additional prices
      outletRecord = await prisma.groceryStore.findUnique({
        where: { id: Number(outletId) },
        include: {
          additionalPrices: { where: { isActive: true } },
        },
      });
      if (!outletRecord) {
        return NextResponse.json({ error: 'Grocery store not found' }, { status: 404 });
      }
      additionalPrices = outletRecord.additionalPrices || [];
      orderOutletFK = { groceryStore: { connect: { id: Number(outletId) } } };
    } else if (categoryLower === 'medicine' || categoryLower === 'medical') {
      // Load Medical Store and its active additional prices
      outletRecord = await prisma.medicalStore.findUnique({
        where: { id: Number(outletId) },
        include: {
          additionalPrices: { where: { isActive: true } },
        },
      });
      if (!outletRecord) {
        return NextResponse.json({ error: 'Medical store not found' }, { status: 404 });
      }
      additionalPrices = outletRecord.additionalPrices || [];
      orderOutletFK = { medicalStore: { connect: { id: Number(outletId) } } };
    } else {
      // Default to Food Outlet
      outletRecord = await prisma.outlet.findUnique({
        where: { id: Number(outletId) },
        include: {
          additionalPrices: { where: { isActive: true } },
        },
      });
      if (!outletRecord) {
        return NextResponse.json({ error: 'Food outlet not found' }, { status: 404 });
      }
      additionalPrices = outletRecord.additionalPrices || [];
      orderOutletFK = { outlet: { connect: { id: Number(outletId) } } };
    }

    // Resolve payment method: optional for Self Pick-up, required for Delivery
    const orderTypeLower = String(orderType || '').toLowerCase();
    const isSelfPickup = orderTypeLower.includes('self'); // covers 'Self Pick-up'

    // Normalize to uppercase when provided
    let resolvedPaymentMethod = typeof paymentMethod === 'string' ? paymentMethod.toUpperCase() : paymentMethod;

    if ((!resolvedPaymentMethod || resolvedPaymentMethod === '') && isSelfPickup) {
      // Default to ANY for self pick-up when not provided
      resolvedPaymentMethod = 'ANY';
    }

    if ((!resolvedPaymentMethod || resolvedPaymentMethod === '') && !isSelfPickup) {
      // For non self-pickup (e.g., Delivery), payment method is required
      return NextResponse.json(
        { error: 'paymentMethod is required for this order type' },
        { status: 400 }
      );
    }

    // Validate against allowed enum values to avoid Prisma enum errors
    const allowedPaymentMethods = ['COD', 'POS', 'ANY'];
    if (!allowedPaymentMethods.includes(resolvedPaymentMethod)) {
      return NextResponse.json(
        { error: `Invalid paymentMethod. Allowed values: ${allowedPaymentMethods.join(', ')}` },
        { status: 400 }
      );
    }

    // Compute totals with additional prices
    const totals = await calculateTotals(orderItems.map((item: any) => ({
      price: item.price,
      quantity: item.quantity
    })), additionalPrices, orderType);
    console.log('[ManyChats] Totals with additionalPrices:', totals);

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
          ...orderOutletFK,
          deliveryAddress,
          deliveryLocation,
          buildingType,
          paymentMethod: resolvedPaymentMethod,
          note: note || '',
          status: 'PENDING',
          subtotal: totals.subtotal,
          serviceFee: totals.serviceFee,
          deliveryFee: totals.deliveryFee,
          vat: totals.vat,
          total: totals.total,
        },
        include: {
          customer: true,
          outlet: true,
          items: true
        }
      });

      console.log(`[ManyChats] Order created with ID: ${order.id}`);
      console.log('[ManyChats] Creating order items:', JSON.stringify(orderItems, null, 2));

      // Create order items in a batch according to category
      let items: any[] = [];
      if (categoryLower === 'grocery') {
        await tx.groceryOrderItem.createMany({
          data: orderItems.map((item: any) => ({
            orderId: order.id,
            groceryMenuItemId: item.groceryMenuItemId,
            quantity: item.quantity,
            price: item.price,
          })),
          skipDuplicates: true,
        });
        items = await tx.groceryOrderItem.findMany({
          where: { orderId: order.id },
          include: { groceryMenuItem: true }
        });
      } else if (categoryLower === 'medicine' || categoryLower === 'medical') {
        await tx.medicineOrderItem.createMany({
          data: orderItems.map((item: any) => ({
            orderId: order.id,
            medicineMenuItemId: item.medicineMenuItemId,
            quantity: item.quantity,
            price: item.price,
          })),
          skipDuplicates: true,
        });
        items = await tx.medicineOrderItem.findMany({
          where: { orderId: order.id },
          include: { medicineMenuItem: true }
        });
      } else {
        await tx.orderItem.createMany({
          data: orderItems.map((item: any) => ({
            orderId: order.id,
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            price: item.price,
          })),
          skipDuplicates: true,
        });
        items = await tx.orderItem.findMany({
          where: { orderId: order.id },
          include: { menuItem: true }
        });
      }

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

    // Format the order items (support food/grocery/medicine)
    const orderItemsResponse = (orderWithItems.items || []).map((item: any) => {
      const itemName = item?.menuItem?.name || item?.groceryMenuItem?.name || item?.medicineMenuItem?.name || item?.menuItemName || 'Item';
      const total = (Number(item.price) * Number(item.quantity)).toFixed(2);
      return { detail: `${itemName} × ${item.quantity} - ${total} AED` };
    });

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
          fees: totals.fees.map(fee => ({
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
