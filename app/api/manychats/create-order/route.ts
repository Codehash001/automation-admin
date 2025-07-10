import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';

// Helper function to parse the text items into structured data
function parseItems(textItems: string | string[]) {
  // If it's a single item, convert it to an array for consistent processing
  const itemsArray = Array.isArray(textItems) ? textItems : [textItems];
  
  const result = [];
  
  for (const itemStr of itemsArray) {
    if (!itemStr || typeof itemStr !== 'string') continue;
    
    // Handle the format: "null, Appam - 2"
    const cleanStr = itemStr.replace(/^null\s*,\s*/, '').trim();
    if (!cleanStr) continue;
    
    // Match item name and quantity (e.g., "Appam - 2")
    const match = cleanStr.match(/^(.+?)\s*-\s*(\d+)(?:\s*[a-zA-Z]*)?$/);
    if (!match) {
      console.warn(`[parseItems] Could not parse item: "${itemStr}"`);
      continue;
    }
    
    const name = match[1].trim();
    const quantity = parseInt(match[2], 10) || 1;
    
    result.push({ name, quantity });
  }
  
  // Group by item name and sum quantities
  const groupedItems = result.reduce<Array<{name: string, quantity: number}>>((acc, item) => {
    const existing = acc.find(i => i.name.toLowerCase() === item.name.toLowerCase());
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      acc.push({ ...item });
    }
    return acc;
  }, []);
  
  console.log('[parseItems] Parsed items:', JSON.stringify(groupedItems, null, 2));
  return groupedItems;
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

    // Calculate totals
    const subtotal = orderItems.reduce((sum, item) => {
      const price = typeof item.price === 'number' ? item.price : Number(item.price);
      return sum + (price * item.quantity);
    }, 0);

    console.log('[ManyChats] Calculating order totals');
    const { serviceFee, deliveryFee, vat, total } = await calculateTotals(
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
      price: typeof item.price === 'number' ? item.price : Number(item.price),
      total: (typeof item.price === 'number' ? item.price : Number(item.price)) * item.quantity
    }));

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
    console.error('[ManyChats] Error creating order:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create order',
        details: process.env.NODE_ENV === 'development' ? error as string : undefined
      },
      { status: 500 }
    );
  }
}
