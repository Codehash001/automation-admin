import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Haversine formula to calculate distance between two points
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}

// Type definitions for JSON fields
type LocationData = {
  lat: string | number;
  lng: string | number;
};

type OperatingHours = {
  open: string;
  close: string;
};

type GroceryStoreData = {
  name: string;
  emiratesId: number;
  whatsappNo: string;
  status: 'OPEN' | 'BUSY' | 'CLOSED';
  exactLocation: LocationData;
  operatingHours: OperatingHours;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const emirateId = searchParams.get('emirateId');
    const responseType = searchParams.get('responseType');
    const storeName = searchParams.get('name');
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');

    // Get store ID by name
    if (storeName) {
      const store = await prisma.groceryStore.findFirst({
        where: { 
          name: {
            equals: storeName,
            mode: 'insensitive' // Case-insensitive search
          }
        },
        select: {
          id: true,
          whatsappNo: true
        }
      });

      if (!store) {
        return NextResponse.json(
          { error: 'Grocery store not found' },
          { status: 404 }
        );
      }

      // Ensure whatsapp number starts with +
      const formattedWhatsappNo = store.whatsappNo?.startsWith('+') 
        ? store.whatsappNo 
        : `+${store.whatsappNo}`;

      return NextResponse.json({ 
        id: store.id,
        whatsappNo: formattedWhatsappNo 
      });
    }

    if (id) {
      // Get single store with relationships
      const store = await prisma.groceryStore.findUnique({
        where: { id: parseInt(id) },
        include: {
          emirates: true,
          _count: {
            select: {
              menus: true,
              orders: true
            }
          }
        }
      });

      if (!store) {
        return NextResponse.json(
          { error: 'Grocery store not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(store);
    }

    // Build the where clause based on filters
    const where: any = {};
    
    if (emirateId && emirateId !== 'all') {
      where.emiratesId = parseInt(emirateId);
    }

    if (lat && lng) {
      const userLocation = {
        lat: parseFloat(lat as string),
        lng: parseFloat(lng as string),
      };

      console.log('User location:', userLocation);

      // Get all stores first, then filter by distance and operating hours
      const allStores = await prisma.groceryStore.findMany({
        where: {
          ...where,
          status: 'OPEN', // Only get open stores
        },
        include: {
          emirates: true,
          _count: {
            select: {
              menus: true,
              orders: true
            }
          }
        }
      });

      console.log(`Found ${allStores.length} open stores before filtering by distance and hours`);

      // Get current time in Dubai timezone (UTC+4)
      const now = new Date();
      const dubaiOffset = 4 * 60; // Dubai is UTC+4
      const userOffset = now.getTimezoneOffset();
      const totalOffset = dubaiOffset + userOffset;
      const dubaiTime = new Date(now.getTime() + totalOffset * 60000);
      
      const currentHour = dubaiTime.getHours();
      const currentMinute = dubaiTime.getMinutes();
      const currentTimeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
      
      console.log(`Current time in Dubai: ${currentTimeStr}`);

      // Filter stores by distance and operating hours
      const filteredStores = allStores
        .filter(store => {
          // Parse location
          const storeLocation = store.exactLocation as any;
          if (!storeLocation || !storeLocation.lat || !storeLocation.lng) {
            console.log(`Store ${store.id} has invalid location data:`, storeLocation);
            return false;
          }

          const storeLat = parseFloat(storeLocation.lat.toString());
          const storeLng = parseFloat(storeLocation.lng.toString());
          
          if (isNaN(storeLat) || isNaN(storeLng)) {
            console.log(`Store ${store.id} has invalid coordinates: lat=${storeLat}, lng=${storeLng}`);
            return false;
          }

          // Calculate distance
          const distance = calculateDistance(
            userLocation.lat, 
            userLocation.lng, 
            storeLat, 
            storeLng
          );
          
          // Store the distance for later sorting and display
          (store as any).distance = distance;
          
          console.log(`Store ${store.id} (${store.name}) is ${distance.toFixed(2)}km away`);
          
          // Filter by distance (5km radius)
          if (distance > 5) {
            console.log(`Store ${store.id} is outside 5km radius (${distance.toFixed(2)}km)`);
            return false;
          }

          // Check operating hours
          const hours = store.operatingHours as any;
          if (!hours || !hours.open || !hours.close) {
            console.log(`Store ${store.id} has invalid operating hours:`, hours);
            return false;
          }

          const openTime = hours.open;
          const closeTime = hours.close;
          
          console.log(`Store ${store.id} hours: ${openTime} - ${closeTime}`);

          // Handle regular case (open < close)
          if (openTime < closeTime) {
            if (currentTimeStr >= openTime && currentTimeStr <= closeTime) {
              console.log(`Store ${store.id} is open (regular hours)`);
              return true;
            }
            console.log(`Store ${store.id} is closed (outside regular hours)`);
            return false;
          } 
          // Handle overnight case (open > close, e.g., 22:00 - 02:00)
          else {
            if (currentTimeStr >= openTime || currentTimeStr <= closeTime) {
              console.log(`Store ${store.id} is open (overnight hours)`);
              return true;
            }
            console.log(`Store ${store.id} is closed (outside overnight hours)`);
            return false;
          }
        })
        .sort((a, b) => (a as any).distance - (b as any).distance);

      console.log(`Returning ${filteredStores.length} stores after filtering`);

      // Format the response based on responseType
      if (responseType === 'objectArray') {
        const formattedStores = filteredStores.map((store: any) => ({
          id: store.id,
          name: store.name,
          emirate: store.emirates.name,
          whatsappNo: store.whatsappNo,
          distance: parseFloat((store as any).distance.toFixed(2)),
          exactLocation: store.exactLocation,
        }));
        
        return NextResponse.json(formattedStores);
      }

      // Default response with full store data
      return NextResponse.json(filteredStores.map((store: any) => ({
        ...store,
        distance: parseFloat((store as any).distance.toFixed(2))
      })));
    }

    // Regular query without location filtering
    const stores = await prisma.groceryStore.findMany({
      where,
      include: {
        emirates: true,
        _count: {
          select: {
            menus: true,
            orders: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    return NextResponse.json(stores);
  } catch (error) {
    console.error('Error fetching grocery stores:', error);
    return NextResponse.json(
      { error: 'Failed to fetch grocery stores' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const data: GroceryStoreData = await request.json();
    
    // Validate required fields
    if (!data.name || !data.emiratesId || !data.whatsappNo) {
      return NextResponse.json(
        { error: 'Name, emiratesId, and whatsappNo are required' },
        { status: 400 }
      );
    }
    
    // Check if store with same name exists
    const existingStore = await prisma.groceryStore.findFirst({
      where: { 
        name: {
          equals: data.name.trim(),
          mode: 'insensitive' // Case-insensitive search
        }
      }
    });

    if (existingStore) {
      return NextResponse.json(
        { error: 'A grocery store with this name already exists' },
        { status: 409 }
      );
    }

    // Create the store
    const store = await prisma.groceryStore.create({
      data: {
        name: data.name.trim(),
        emiratesId: data.emiratesId,
        whatsappNo: data.whatsappNo.trim(),
        status: data.status || 'CLOSED',
        exactLocation: data.exactLocation ? {
          lat: parseFloat(data.exactLocation.lat as string),
          lng: parseFloat(data.exactLocation.lng as string),
        } : { lat: 0, lng: 0 },
        operatingHours: data.operatingHours ? {
          open: data.operatingHours.open,
          close: data.operatingHours.close,
        } : { open: "00:00", close: "00:00" },
      },
      include: {
        emirates: true,
      }
    });

    return NextResponse.json(store, { status: 201 });
  } catch (error) {
    console.error('Error creating grocery store:', error);
    return NextResponse.json(
      { error: 'Failed to create grocery store' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json(
        { error: 'Valid grocery store ID is required' },
        { status: 400 }
      );
    }
    
    const data: Partial<GroceryStoreData> = await request.json();
    
    // Check if store exists
    const existingStore = await prisma.groceryStore.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingStore) {
      return NextResponse.json(
        { error: 'Grocery store not found' },
        { status: 404 }
      );
    }

    // Check if name is being changed and if the new name already exists
    if (data.name && data.name.trim() !== existingStore.name) {
      const nameExists = await prisma.groceryStore.findFirst({
        where: {
          name: {
            equals: data.name.trim(),
            mode: 'insensitive' // Case-insensitive search
          },
          id: { not: parseInt(id) },
        },
      });

      if (nameExists) {
        return NextResponse.json(
          { error: 'A grocery store with this name already exists' },
          { status: 409 }
        );
      }
    }

    // Update the store
    const updatedStore = await prisma.groceryStore.update({
      where: { id: parseInt(id) },
      data: {
        name: data.name?.trim(),
        emiratesId: data.emiratesId,
        whatsappNo: data.whatsappNo?.trim(),
        status: data.status,
        exactLocation: data.exactLocation ? {
          lat: parseFloat(data.exactLocation.lat as string),
          lng: parseFloat(data.exactLocation.lng as string),
        } : existingStore.exactLocation as any,
        operatingHours: data.operatingHours ? {
          open: data.operatingHours.open,
          close: data.operatingHours.close,
        } : existingStore.operatingHours as any,
      },
      include: {
        emirates: true,
        _count: {
          select: {
            menus: true,
            orders: true
          }
        }
      }
    });

    return NextResponse.json(updatedStore);
  } catch (error) {
    console.error('Error updating grocery store:', error);
    return NextResponse.json(
      { error: 'Failed to update grocery store' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json(
        { error: 'Valid grocery store ID is required' },
        { status: 400 }
      );
    }

    // Check if store exists and get related counts
    const store = await prisma.groceryStore.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: {
            menus: true,
            orders: true
          }
        }
      }
    });

    if (!store) {
      return NextResponse.json(
        { error: 'Grocery store not found' },
        { status: 404 }
      );
    }

    // Prevent deletion if there are associated menus or orders
    if (store._count.menus > 0 || store._count.orders > 0) {
      return NextResponse.json(
        { 
          error: 'Cannot delete grocery store with associated menus or orders',
          hasMenus: store._count.menus > 0,
          hasOrders: store._count.orders > 0
        },
        { status: 400 }
      );
    }

    // Delete the store
    await prisma.groceryStore.delete({
      where: { id: parseInt(id) }
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting grocery store:', error);
    return NextResponse.json(
      { error: 'Failed to delete grocery store' },
      { status: 500 }
    );
  }
}
