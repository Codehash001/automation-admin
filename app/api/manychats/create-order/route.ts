import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Helper function to parse the text items into structured data
function parseItems(textItems: string | string[]) {
  // If it's a single item, convert it to an array for consistent processing
  const itemsArray = Array.isArray(textItems) ? textItems : [textItems];
  
  const result: { name: string; price: number; quantity: number; }[] = [];
  
  for (const itemStr of itemsArray) {
    if (!itemStr || typeof itemStr !== 'string') continue;
    
    // Split by comma to get individual items
    const items = itemStr.split(',').map(i => i.trim()).filter(Boolean);
    
    for (let item of items) {
      // Handle the format: "Appam - 2" or "null, Appam - 2"
      item = item.replace(/^null\s*,\s*/, '').trim();
      if (!item) continue;
      
      // Match item name and price (e.g., "Appam - 2")
      const match = item.match(/^(.+?)\s*-\s*(\d+(?:\.\d+)?)\s*$/);
      if (!match) {
        console.warn(`[parseItems] Could not parse item: "${item}"`);
        continue;
      }
      
      const name = match[1].trim();
      const price = parseFloat(match[2]);
      
      // Check if we already have this exact item (same name and price)
      const existingItem = result.find(i => 
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
  // Get additional prices from database
  const additionalPrices = await prisma.additionalPrice.findMany({
    where: { isActive: true },
  });

  const serviceFeeRate = additionalPrices.find((p: { name: string; }) => p.name === 'SERVICE_FEE')?.value.toNumber() || 0.1;
  const deliveryFee = additionalPrices.find((p: { name: string; }) => p.name === 'DELIVERY_FEE')?.value.toNumber() || 10;
  const vatRate = additionalPrices.find((p: { name: string; }) => p.name === 'VAT')?.value.toNumber() || 0.05;

  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const serviceFee = subtotal * serviceFeeRate;
  const vat = (subtotal + serviceFee + deliveryFee) * vatRate;
  const total = subtotal + serviceFee + deliveryFee + vat;

  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    serviceFee: parseFloat(serviceFee.toFixed(2)),
    deliveryFee: parseFloat(deliveryFee.toFixed(2)),
    vat: parseFloat(vat.toFixed(2)),
    total: parseFloat(total.toFixed(2))
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
    console.log('[ManyChats] Available menu items:', menuItems.map(mi => ({
      id: mi.id,
      name: mi.name,
      price: mi.price,
      menuName: mi.menu.name
    })));

    // Map parsed items to menu items
    const orderItems: { menuItemId: number; quantity: number; price: number; menuItemName: string; }[] = [];
    for (const parsedItem of parsedItems) {
      // Find menu item by name (case-insensitive)
      const menuItem = menuItems.find(mi => 
        mi.name.trim().toLowerCase() === parsedItem.name.trim().toLowerCase()
      );
      
      if (!menuItem) {
        console.error(`[ManyChats] Menu item not found: "${parsedItem.name}"`);
        console.error(`[ManyChats] Available items: ${menuItems.map(mi => `"${mi.name}"`).join(', ')}`);
        return NextResponse.json(
          { 
            error: `Menu item not found: "${parsedItem.name}"`,
            availableItems: menuItems.map(mi => ({
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
    const subtotal = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    console.log('[ManyChats] Calculating order totals');
    const { serviceFee, deliveryFee, vat, total } = await calculateTotals(
      orderItems.map(item => ({
        price: item.price,
        quantity: item.quantity
      })),
      parseInt(outletId)
    );

    console.log('[ManyChats] Starting database transaction');
    // Create the order in a transaction
    const order = await prisma.$transaction(async (prisma) => {
      console.log('[ManyChats] Creating order record');
      
      // First create the order
      const newOrder = await prisma.order.create({
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

      console.log(`[ManyChats] Order created with ID: ${newOrder.id}`);
      console.log('[ManyChats] Creating order items:', JSON.stringify(orderItems, null, 2));

      // Create order items
      const createdItems = await Promise.all(
        orderItems.map(item => 
          prisma.orderItem.create({
            data: {
              orderId: newOrder.id,
              menuItemId: item.menuItemId,
              quantity: item.quantity,
              price: item.price,
            },
            include: {
              menuItem: true
            }
          })
        )
      );

      console.log(`[ManyChats] Created ${createdItems.length} order items`);
      console.log('[ManyChats] Created items:', JSON.stringify(createdItems, null, 2));

      return {
        ...newOrder,
        items: createdItems
      };
    });

    console.log(`[ManyChats] Transaction completed for order ${order.id}`);

    // Get order with all related data for the response
    const fullOrder = await prisma.order.findUnique({
      where: { id: order.id },
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

    if (!fullOrder) {
      throw new Error('Failed to retrieve order details');
    }

    // Format the order items
    const orderItemsResponse = fullOrder.items.map(item => ({
      id: item.menuItemId,
      name: item.menuItem.name,
      quantity: item.quantity,
      price: item.price,
      total: item.price ? Number(item.price) * item.quantity : 0
    }));

    // Calculate item quantities for grouped items
    const groupedItems = orderItemsResponse.reduce((acc: any, item) => {
      const existingItem = acc.find((i: any) => 
        i.name === item.name && 
        i.price === item.price
      );
      
      if (existingItem) {
        existingItem.quantity += item.quantity;
        existingItem.total += item.total;
      } else {
        acc.push({ ...item });
      }
      return acc;
    }, []);

    // Prepare the structured response
    const response = {
      success: true,
      order: {
        id: fullOrder.id,
        status: fullOrder.status,
        orderType: fullOrder.orderType,
        paymentMethod: fullOrder.paymentMethod,
        createdAt: fullOrder.createdAt,
        customer: {
          id: fullOrder.customer.id,
          name: fullOrder.customer.name,
          phone: fullOrder.customer.whatsappNumber
        },
        outlet: {
          id: fullOrder.outlet.id,
          name: fullOrder.outlet.name,
          whatsappNo: fullOrder.outlet.whatsappNo
        },
        delivery: {
          address: fullOrder.deliveryAddress,
          location: fullOrder.deliveryLocation,
          buildingType: fullOrder.buildingType
        },
        items: groupedItems,
        summary: {
          subtotal: fullOrder.subtotal,
          deliveryFee: fullOrder.deliveryFee,
          serviceFee: fullOrder.serviceFee,
          vat: fullOrder.vat,
          total: fullOrder.total
        },
        note: fullOrder.note
      }
    };

    const notificationMessage = generateOrderNotification(fullOrder);

    console.log(`[ManyChats] Order ${fullOrder.id} created successfully`);
    return NextResponse.json({
      ...response,
      notification: {
        message: notificationMessage,
        orderId: fullOrder.id,
        total: fullOrder.total
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
