import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';

// Helper function to parse the text items into structured data
function parseItems(textItems: string) {
  // Remove the 'null, ' prefix if it exists
  const cleanText = textItems.startsWith('null, ') ? textItems.substring(6) : textItems;
  
  // Split by comma and process each item
  return cleanText.split(',').map(item => {
    const trimmed = item.trim();
    // Match item name and price (e.g., "Idly Samber - 10 AED")
    const match = trimmed.match(/^(.*?)\s*-\s*([\d.]+)\s*AED?$/i);
    if (!match) return null;
    
    // Keep the original case of the name
    const name = match[1].trim();
    const price = parseFloat(match[2]);
    
    return { name, price };
  }).filter(Boolean)
    .reduce((acc, item) => {
      if (!item) return acc;
      
      const existing = acc.find(i => i.name.toLowerCase() === item.name.toLowerCase());
      if (existing) {
        existing.quantity++;
      } else {
        acc.push({ ...item, quantity: 1 });
      }
      return acc;
    }, [] as Array<{ name: string; price: number; quantity: number }>);
}

// Calculate order totals
async function calculateTotals(items: Array<{ price: number; quantity: number }>, outletId: number) {
  // Get additional prices from database
  const additionalPrices = await prisma.additionalPrice.findMany({
    where: { isActive: true },
  });

  const serviceFeeRate = additionalPrices.find((p: { name: string; }) => p.name === 'SERVICE_FEE')?.value.toNumber() || 0.1; // 10% default
  const deliveryFee = additionalPrices.find((p: { name: string; }) => p.name === 'DELIVERY_FEE')?.value.toNumber() || 10; // 10 AED default
  const vatRate = additionalPrices.find((p: { name: string; }) => p.name === 'VAT')?.value.toNumber() || 0.05; // 5% default

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

// Generate markdown formatted order message with better formatting
function generateOrderMessage(order: any) {
  // Group items by name and sum quantities
  const groupedItems = order.items.reduce((acc: any, item: any) => {
    const key = `${item.menuItem.name}-${item.price}`;
    if (!acc[key]) {
      acc[key] = {
        name: item.menuItem.name,
        price: item.price,
        quantity: 0,
        total: 0
      };
    }
    acc[key].quantity += item.quantity;
    acc[key].total += item.price * item.quantity;
    return acc;
  }, {});

  // Convert to array and format each line
  const itemsList = Object.values(groupedItems).map((item: any) => {
    const itemName = item.name.padEnd(25, ' ').substring(0, 25);
    const itemQty = `${item.quantity}x`.padStart(5, ' ');
    const itemPrice = `${item.price.toFixed(2)}`.padStart(7, ' ');
    const itemTotal = item.total.toFixed(2).padStart(8, ' ');
    return `${itemName} ${itemQty} @ ${itemPrice} = ${itemTotal} AED`;
  }).join('\n');

  // Format the order details
  const formatLine = (label: string, value: string | number, isBold = false) => {
    const formattedValue = typeof value === 'number' ? value.toFixed(2) + ' AED' : value;
    const line = `${label}:`.padEnd(20, ' ') + formattedValue;
    return isBold ? `*${line}*` : line;
  };

  // Get current UAE time
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

  // Build the message
  return `
╔══════════════════════════════════════╗
║            🛒 ORDER #${order.id.toString().padEnd(8, ' ')}         ║
╚══════════════════════════════════════╝

` +
    `📅 ${uaeTime}\n\n` +
    `👤 *CUSTOMER DETAILS*\n` +
    `${'-'.repeat(40)}\n` +
    `${formatLine('Name', order.customer.name)}\n` +
    `${formatLine('Location', order.deliveryLocation || 'N/A')}\n` +
    `${formatLine('Building', order.buildingType || 'N/A')}\n` +
    `${formatLine('Address', order.deliveryAddress || 'N/A')}\n\n` +
    `🛒 *ORDER ITEMS*\n` +
    `${'-'.repeat(40)}\n` +
    `${itemsList}\n\n` +
    `� *PAYMENT SUMMARY*\n` +
    `${'-'.repeat(40)}\n` +
    `${formatLine('Subtotal', order.subtotal)}\n` +
    `${formatLine('Delivery Fee', order.deliveryFee)}\n` +
    `${formatLine('Service Fee', order.serviceFee)}\n` +
    `${formatLine('VAT (5%)', order.vat)}\n` +
    `${'-'.repeat(40)}\n` +
    `${formatLine('TOTAL', order.total, true)}\n\n` +
    `📝 *NOTES*\n` +
    `${'-'.repeat(40)}\n` +
    `${order.note || 'No additional notes'}\n\n` +
    `Thank you for your order! 🙏`;
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
    console.log(`[ManyChats] Parsed items:`, JSON.stringify(parsedItems, null, 2));
    
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

    // Map parsed items to menu items and calculate quantities
    const orderItems: {
      menuItemId: number; quantity: number; price: Decimal; menuItemName: string; // For debugging
    }[] = [];
    for (const parsedItem of parsedItems) {
      // Case-insensitive search for menu item
      const menuItem = menuItems.find(mi => 
        mi.name.trim().toLowerCase() === parsedItem.name.trim().toLowerCase()
      );
      
      if (!menuItem) {
        console.error(`[ManyChats] Menu item not found: "${parsedItem.name}"`);
        console.error(`[ManyChats] Available items: ${menuItems.map(mi => `"${mi.name}"`).join(', ')}`);
        return NextResponse.json(
          { 
            error: `Menu item not found: "${parsedItem.name}"`,
            availableItems: menuItems.map(mi => mi.name)
          },
          { status: 400 }
        );
      }
      
      orderItems.push({
        menuItemId: menuItem.id,
        quantity: parsedItem.quantity,
        price: menuItem.price,
        menuItemName: menuItem.name // For debugging
      });
    }

    console.log('[ManyChats] Mapped order items:', JSON.stringify(orderItems, null, 2));

    console.log('[ManyChats] Calculating order totals');
    const { subtotal, serviceFee, deliveryFee, vat, total } = await calculateTotals(
      orderItems.map(item => ({
        price: typeof item.price === 'number' ? item.price : Number(item.price),
        quantity: item.quantity
      })),
      parseInt(outletId)
    );

    console.log('[ManyChats] Starting database transaction');
    // Create the order in a transaction
    const order = await prisma.$transaction(async (prisma) => {
      console.log('[ManyChats] Creating order record');
      // Create the order
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

      // Create order items
      console.log(`[ManyChats] Creating ${orderItems.length} order items`);
      await prisma.orderItem.createMany({
        data: orderItems.map(item => ({
          orderId: newOrder.id,
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          price: item.price,
        })),
      });
      console.log('[ManyChats] Order items created successfully');

      return newOrder;
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
    const orderItemsResponse = fullOrder.items.map(item => {
      // Convert Prisma.Decimal to number
      const price = typeof item.price === 'number' ? item.price : Number(item.price);
      const quantity = item.quantity;
      
      return {
        id: item.menuItemId,
        name: item.menuItem.name,
        quantity: quantity,
        price: price,
        total: price * quantity
      };
    });

    // Calculate item quantities for grouped items
    const groupedItems = orderItemsResponse.reduce((acc: any, item) => {
      const existingItem = acc.find((i: any) => 
        i.name === item.name && 
        i.price === item.price
      );
      
      if (existingItem) {
        existingItem.quantity += item.quantity;
        existingItem.total = existingItem.price * existingItem.quantity;
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

    console.log(`[ManyChats] Order ${fullOrder.id} created successfully`);
    return NextResponse.json(response);
  } catch (error) {
    console.error('[ManyChats] Error creating order:', {
      message: error as string,
    });
    return NextResponse.json(
      { 
        error: error as string || 'Failed to create order',
        details: process.env.NODE_ENV === 'development' ? error as string : undefined
      },
      { status: 500 }
    );
  }
}
