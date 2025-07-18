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

type MedicalStoreData = {
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
      const store = await prisma.medicalStore.findFirst({
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
          { error: 'Medical store not found' },
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
      const store = await prisma.medicalStore.findUnique({
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
          { error: 'Medical store not found' },
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
      const allStores = await prisma.medicalStore.findMany({
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
      const currentTimeInMinutes = currentHour * 60 + currentMinute;

      console.log(`Current Dubai time: ${dubaiTime.toLocaleTimeString()}`);
      console.log(`Current time in minutes: ${currentTimeInMinutes}`);

      // Filter stores by distance (within 5km) and operating hours
      const nearbyStores = allStores.filter(store => {
        const storeLocation = store.exactLocation as any;
        const storeLat = parseFloat(storeLocation.lat);
        const storeLng = parseFloat(storeLocation.lng);
        
        // Calculate distance
        const distance = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          storeLat,
          storeLng
        );

        console.log(`Store: ${store.name}, Distance: ${distance.toFixed(2)}km`);

        // Check if within 5km radius
        if (distance > 5) {
          console.log(`Store ${store.name} is too far (${distance.toFixed(2)}km)`);
          return false;
        }

        // Check operating hours
        const operatingHours = store.operatingHours as any;
        const openTime = operatingHours.open; // Format: "HH:MM"
        const closeTime = operatingHours.close; // Format: "HH:MM"

        const [openHour, openMinute] = openTime.split(':').map(Number);
        const [closeHour, closeMinute] = closeTime.split(':').map(Number);

        const openTimeInMinutes = openHour * 60 + openMinute;
        const closeTimeInMinutes = closeHour * 60 + closeMinute;

        console.log(`Store: ${store.name}, Open: ${openTime} (${openTimeInMinutes}), Close: ${closeTime} (${closeTimeInMinutes}), Current: ${currentTimeInMinutes}`);

        let isOpen = false;
        if (closeTimeInMinutes > openTimeInMinutes) {
          // Normal hours (e.g., 09:00 - 21:00)
          isOpen = currentTimeInMinutes >= openTimeInMinutes && currentTimeInMinutes <= closeTimeInMinutes;
        } else {
          // Overnight hours (e.g., 22:00 - 02:00)
          isOpen = currentTimeInMinutes >= openTimeInMinutes || currentTimeInMinutes <= closeTimeInMinutes;
        }

        console.log(`Store ${store.name} is ${isOpen ? 'open' : 'closed'}`);

        return isOpen;
      });

      console.log(`Found ${nearbyStores.length} stores within 5km and open now`);

      // Add distance to each store and sort by distance
      const storesWithDistance = nearbyStores.map((store: any) => {
        const storeLocation = store.exactLocation as any;
        const storeLat = parseFloat(storeLocation.lat);
        const storeLng = parseFloat(storeLocation.lng);
        
        const distance = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          storeLat,
          storeLng
        );

        return {
          ...store,
          distance: Math.round(distance * 100) / 100 // Round to 2 decimal places
        };
      }).sort((a, b) => a.distance - b.distance);

      if (responseType === 'objectArray') {
        return NextResponse.json(storesWithDistance);
      }

      // Return array format (for backward compatibility)
      const storeArray = storesWithDistance.map((store: any) => [
        store.id,
        store.name,
        store.whatsappNo,
        store.emirates.name,
        store.distance
      ]);

      return NextResponse.json(storeArray);
    }

    // Get all stores with filtering
    const stores = await prisma.medicalStore.findMany({
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
    console.error('Error fetching medical stores:', error);
    return NextResponse.json(
      { error: 'Failed to fetch medical stores' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const data: MedicalStoreData = await request.json();
    
    // Validate required fields
    if (!data.name?.trim()) {
      return NextResponse.json(
        { error: 'Store name is required' },
        { status: 400 }
      );
    }

    if (!data.emiratesId) {
      return NextResponse.json(
        { error: 'Emirates ID is required' },
        { status: 400 }
      );
    }

    if (!data.whatsappNo?.trim()) {
      return NextResponse.json(
        { error: 'WhatsApp number is required' },
        { status: 400 }
      );
    }

    // Check if store name already exists
    const existingStore = await prisma.medicalStore.findFirst({
      where: {
        name: {
          equals: data.name.trim(),
          mode: 'insensitive' // Case-insensitive search
        }
      }
    });

    if (existingStore) {
      return NextResponse.json(
        { error: 'A medical store with this name already exists' },
        { status: 409 }
      );
    }

    // Create the store
    const newStore = await prisma.medicalStore.create({
      data: {
        name: data.name.trim(),
        emiratesId: data.emiratesId,
        whatsappNo: data.whatsappNo.trim(),
        status: data.status || 'CLOSED',
        exactLocation: {
          lat: parseFloat(data.exactLocation.lat as string),
          lng: parseFloat(data.exactLocation.lng as string),
        },
        operatingHours: {
          open: data.operatingHours.open,
          close: data.operatingHours.close,
        },
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

    return NextResponse.json(newStore, { status: 201 });
  } catch (error) {
    console.error('Error creating medical store:', error);
    return NextResponse.json(
      { error: 'Failed to create medical store' },
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
        { error: 'Valid medical store ID is required' },
        { status: 400 }
      );
    }
    
    const data: Partial<MedicalStoreData> = await request.json();
    
    // Check if store exists
    const existingStore = await prisma.medicalStore.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingStore) {
      return NextResponse.json(
        { error: 'Medical store not found' },
        { status: 404 }
      );
    }

    // Check if name is being changed and if the new name already exists
    if (data.name && data.name.trim() !== existingStore.name) {
      const nameExists = await prisma.medicalStore.findFirst({
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
          { error: 'A medical store with this name already exists' },
          { status: 409 }
        );
      }
    }

    // Update the store
    const updatedStore = await prisma.medicalStore.update({
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
    console.error('Error updating medical store:', error);
    return NextResponse.json(
      { error: 'Failed to update medical store' },
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
        { error: 'Valid medical store ID is required' },
        { status: 400 }
      );
    }

    // Check if store exists and get related counts
    const store = await prisma.medicalStore.findUnique({
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
        { error: 'Medical store not found' },
        { status: 404 }
      );
    }

    // Prevent deletion if there are associated menus or orders
    if (store._count.menus > 0 || store._count.orders > 0) {
      return NextResponse.json(
        { 
          error: 'Cannot delete medical store with associated menus or orders',
          hasMenus: store._count.menus > 0,
          hasOrders: store._count.orders > 0
        },
        { status: 400 }
      );
    }

    // Delete the store
    await prisma.medicalStore.delete({
      where: { id: parseInt(id) }
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting medical store:', error);
    return NextResponse.json(
      { error: 'Failed to delete medical store' },
      { status: 500 }
    );
  }
}
