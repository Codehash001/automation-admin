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

type OutletData = {
  name: string;
  emiratesId: number;
  cuisineIds: number[];
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
    const cuisineId = searchParams.get('cuisineId');
    const responseType = searchParams.get('responseType');
    const outletName = searchParams.get('name');
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');

    // Get outlet ID by name
    if (outletName) {
      const outlet = await prisma.outlet.findFirst({
        where: { 
          name: {
            equals: outletName,
            mode: 'insensitive' // Case-insensitive search
          }
        },
        select: {
          id: true,
          whatsappNo: true
        }
      });

      if (!outlet) {
        return NextResponse.json(
          { error: 'Outlet not found' },
          { status: 404 }
        );
      }

      // Ensure whatsapp number starts with +
      const formattedWhatsappNo = outlet.whatsappNo?.startsWith('+') 
        ? outlet.whatsappNo 
        : `+${outlet.whatsappNo}`;

      return NextResponse.json({ 
        id: outlet.id,
        whatsappNo: formattedWhatsappNo 
      });
    }

    if (id) {
      // Get single outlet with relationships
      const outlet = await prisma.outlet.findUnique({
        where: { id: parseInt(id) },
        include: {
          emirates: true,
          cuisines: {
            include: {
              cuisine: true
            }
          },
          _count: {
            select: {
              menus: true,
              orders: true
            }
          }
        }
      });

      if (!outlet) {
        return NextResponse.json(
          { error: 'Outlet not found' },
          { status: 404 }
        );
      }

      // Format the response
      const formattedOutlet = {
        ...outlet,
        cuisines: outlet.cuisines.map(oc => ({
          cuisine: oc.cuisine
        }))
      };

      return NextResponse.json(formattedOutlet);
    }

    // Build the where clause based on filters
    const where: any = {};
    
    if (emirateId) {
      where.emiratesId = parseInt(emirateId);
    }
    
    if (cuisineId) {
      where.cuisines = {
        some: {
          cuisineId: parseInt(cuisineId)
        }
      };
    }

    if (lat && lng) {
      const userLocation = {
        lat: parseFloat(lat as string),
        lng: parseFloat(lng as string),
      };

      console.log('User location:', userLocation);

      // Get all outlets first, then filter by distance and operating hours
      const allOutlets = await prisma.outlet.findMany({
        where: {
          ...where,
          status: 'OPEN', // Only get open outlets
        },
        include: {
          emirates: true,
          cuisines: {
            include: {
              cuisine: true
            }
          },
          _count: {
            select: {
              menus: true,
              orders: true
            }
          }
        },
        orderBy: { name: 'asc' }
      });

      console.log(`Found ${allOutlets.length} open outlets before distance filtering`);

      // Get current time in Dubai timezone
      const now = new Date();
      const currentTime = now.toLocaleTimeString('en-US', { 
        hour12: false, 
        timeZone: 'Asia/Dubai',
        hour: '2-digit',
        minute: '2-digit'
      });

      console.log('Current time in Dubai:', currentTime);

      // Filter outlets within 5km radius and check operating hours
      const availableOutlets = allOutlets.filter(outlet => {
        // Cast JSON fields to proper types
        const location = outlet.exactLocation as LocationData;
        const hours = outlet.operatingHours as OperatingHours;

        // Skip outlets without location data
        if (!location || !location.lat || !location.lng) {
          console.log(`Outlet ${outlet.name} skipped: missing location data`);
          return false;
        }

        // Ensure lat/lng are numbers
        const outletLat = typeof location.lat === 'string' ? parseFloat(location.lat) : location.lat;
        const outletLng = typeof location.lng === 'string' ? parseFloat(location.lng) : location.lng;

        // Validate coordinates
        if (isNaN(outletLat) || isNaN(outletLng)) {
          console.log(`Outlet ${outlet.name} skipped: invalid coordinates`, { lat: location.lat, lng: location.lng });
          return false;
        }

        // Calculate distance using Haversine formula
        const distance = calculateDistance(
          userLocation.lat, 
          userLocation.lng,
          outletLat, 
          outletLng
        );

        console.log(`Outlet ${outlet.name}: distance = ${distance.toFixed(2)}km, location = [${outletLat}, ${outletLng}]`);

        // Check if within 5km radius
        const withinRadius = distance <= 5;

        // Check if currently open based on operating hours
        let isCurrentlyOpen = true;
        if (hours?.open && hours?.close) {
          const openTime = hours.open;
          const closeTime = hours.close;
          
          // Handle time comparison (HH:MM format)
          if (closeTime < openTime) {
            // Crosses midnight (e.g., 22:00 - 02:00)
            isCurrentlyOpen = currentTime >= openTime || currentTime <= closeTime;
          } else {
            // Same day (e.g., 09:00 - 22:00)
            isCurrentlyOpen = currentTime >= openTime && currentTime <= closeTime;
          }
          
          console.log(`Outlet ${outlet.name}: hours ${openTime}-${closeTime}, currently open: ${isCurrentlyOpen}`);
        }

        const isAvailable = withinRadius && isCurrentlyOpen;
        console.log(`Outlet ${outlet.name}: within radius: ${withinRadius}, currently open: ${isCurrentlyOpen}, available: ${isAvailable}`);

        return isAvailable;
      });

      console.log(`Found ${availableOutlets.length} available outlets within 5km radius`);

      // Sort by distance (closest first) and add distance info
      const sortedOutlets = availableOutlets
        .map(outlet => {
          const location = outlet.exactLocation as LocationData;
          const outletLat = typeof location.lat === 'string' ? parseFloat(location.lat) : location.lat;
          const outletLng = typeof location.lng === 'string' ? parseFloat(location.lng) : location.lng;
          
          return {
            ...outlet,
            distance: parseFloat(calculateDistance(
              userLocation.lat, 
              userLocation.lng,
              outletLat, 
              outletLng
            ).toFixed(2))
          };
        })
        .sort((a, b) => a.distance - b.distance);

      // Check if responseType is objectArray
      if (responseType === 'objectArray') {
        const outletsObject: { [key: string]: any } = {};
        sortedOutlets.forEach((outlet, index) => {
          outletsObject[`outlet${index + 1}`] = {
            ...outlet,
            cuisines: outlet.cuisines.map(oc => ({
              cuisine: oc.cuisine
            }))
          };
        });
        return NextResponse.json({ outlets: outletsObject });
      }

      // Default response format (array)
      const formattedOutlets = sortedOutlets.map(outlet => ({
        ...outlet,
        cuisines: outlet.cuisines.map(oc => ({
          cuisine: oc.cuisine
        }))
      }));

      return NextResponse.json(formattedOutlets);
    }

    // Get all outlets with relationships
    const outlets = await prisma.outlet.findMany({
      where,
      include: {
        emirates: true,
        cuisines: {
          include: {
            cuisine: true
          }
        },
        _count: {
          select: {
            menus: true,
            orders: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    // Check if responseType is objectArray
    if (responseType === 'objectArray') {
      // Format as object array
      const outletsObject: { [key: string]: any } = {};
      outlets.forEach((outlet, index) => {
        outletsObject[`outlet${index + 1}`] = {
          ...outlet,
          cuisines: outlet.cuisines.map(oc => ({
            cuisine: oc.cuisine
          }))
        };
      });
      return NextResponse.json({ outlets: outletsObject });
    }

    // Default response format (array)
    const formattedOutlets = outlets.map(outlet => ({
      ...outlet,
      cuisines: outlet.cuisines.map(oc => ({
        cuisine: oc.cuisine
      }))
    }));

    return NextResponse.json(formattedOutlets);
  } catch (error) {
    console.error('Error fetching outlets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch outlets' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const data: OutletData = await request.json();
    
    // Validate required fields
    if (!data.name || !data.emiratesId || !data.cuisineIds || !data.whatsappNo || !data.exactLocation || !data.operatingHours) {
      return NextResponse.json(
        { error: 'Name, emirate, cuisines, WhatsApp number, exact location, and operating hours are required' },
        { status: 400 }
      );
    }

    // Check if emirate exists
    const emirate = await prisma.emirates.findUnique({
      where: { id: data.emiratesId }
    });

    if (!emirate) {
      return NextResponse.json(
        { error: 'Selected emirate does not exist' },
        { status: 400 }
      );
    }

    // Check if all cuisines exist
    const cuisines = await prisma.cuisine.findMany({
      where: {
        id: { in: data.cuisineIds }
      }
    });

    if (cuisines.length !== data.cuisineIds.length) {
      return NextResponse.json(
        { error: 'One or more selected cuisines do not exist' },
        { status: 400 }
      );
    }

    // Check if outlet with same name already exists in the same emirate
    const existingOutlet = await prisma.outlet.findFirst({
      where: {
        name: data.name.trim(),
        emiratesId: data.emiratesId
      }
    });

    if (existingOutlet) {
      return NextResponse.json(
        { error: 'An outlet with this name already exists in the selected emirate' },
        { status: 409 }
      );
    }

    // Create the outlet with its relationships
    const outlet = await prisma.$transaction(async (prisma) => {
      const newOutlet = await prisma.outlet.create({
        data: {
          name: data.name.trim(),
          emiratesId: data.emiratesId,
          whatsappNo: data.whatsappNo.trim(),
          status: data.status || 'OPEN',
          exactLocation: {
            lat: parseFloat(data.exactLocation.lat as string),
            lng: parseFloat(data.exactLocation.lng as string),
          },
          operatingHours: {
            open: data.operatingHours.open,
            close: data.operatingHours.close,
          },
          cuisines: {
            create: data.cuisineIds.map(cuisineId => ({
              cuisine: { connect: { id: cuisineId } }
            }))
          }
        },
        include: {
          emirates: true,
          cuisines: {
            include: {
              cuisine: true
            }
          }
        }
      });

      return newOutlet;
    });

    // Format the response
    const formattedOutlet = {
      ...outlet,
      cuisines: outlet.cuisines.map(oc => ({
        cuisine: oc.cuisine
      }))
    };

    return NextResponse.json(formattedOutlet, { status: 201 });
  } catch (error) {
    console.error('Error creating outlet:', error);
    return NextResponse.json(
      { error: 'Failed to create outlet' },
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
        { error: 'Valid outlet ID is required' },
        { status: 400 }
      );
    }

    const data: Partial<OutletData> = await request.json();
    
    // Check if outlet exists
    const existingOutlet = await prisma.outlet.findUnique({
      where: { id: parseInt(id) },
      include: {
        cuisines: true
      }
    });

    if (!existingOutlet) {
      return NextResponse.json(
        { error: 'Outlet not found' },
        { status: 404 }
      );
    }

    // Check if emirate exists if being updated
    if (data.emiratesId) {
      const emirate = await prisma.emirates.findUnique({
        where: { id: data.emiratesId }
      });

      if (!emirate) {
        return NextResponse.json(
          { error: 'Selected emirate does not exist' },
          { status: 400 }
        );
      }
    }

    // Check if all cuisines exist if being updated
    if (data.cuisineIds) {
      const cuisines = await prisma.cuisine.findMany({
        where: {
          id: { in: data.cuisineIds }
        }
      });

      if (cuisines.length !== data.cuisineIds.length) {
        return NextResponse.json(
          { error: 'One or more selected cuisines do not exist' },
          { status: 400 }
        );
      }
    }

    // Check for duplicate name in the same emirate
    if (data.name && data.name.trim() !== existingOutlet.name) {
      const nameInUse = await prisma.outlet.findFirst({
        where: {
          name: data.name.trim(),
          emiratesId: data.emiratesId || existingOutlet.emiratesId,
          id: { not: parseInt(id) }
        }
      });

      if (nameInUse) {
        return NextResponse.json(
          { error: 'An outlet with this name already exists in the selected emirate' },
          { status: 409 }
        );
      }
    }

    // Update the outlet with its relationships
    const updatedOutlet = await prisma.$transaction(async (prisma) => {
      // Update the outlet
      await prisma.outlet.update({
        where: { id: parseInt(id) },
        data: {
          name: data.name?.trim(),
          emiratesId: data.emiratesId,
          whatsappNo: data.whatsappNo?.trim(),
          status: data.status,
          exactLocation: data.exactLocation ? {
            lat: parseFloat(data.exactLocation.lat as string),
            lng: parseFloat(data.exactLocation.lng as string),
          } : existingOutlet.exactLocation as any,
          operatingHours: data.operatingHours ? {
            open: data.operatingHours.open,
            close: data.operatingHours.close,
          } : existingOutlet.operatingHours as any,
        },
      });

      // If cuisines are being updated, update the join table
      if (data.cuisineIds) {
        // Delete all existing cuisine connections
        await prisma.outletCuisine.deleteMany({
          where: { outletId: parseInt(id) }
        });

        // Create new connections
        await prisma.outletCuisine.createMany({
          data: data.cuisineIds.map(cuisineId => ({
            outletId: parseInt(id),
            cuisineId: cuisineId,
            assignedAt: new Date()
          })),
          skipDuplicates: true,
        });
      }

      // Fetch the updated outlet with all relationships
      return await prisma.outlet.findUnique({
        where: { id: parseInt(id) },
        include: {
          emirates: true,
          cuisines: {
            include: {
              cuisine: true
            }
          },
          _count: {
            select: {
              menus: true,
              orders: true
            }
          }
        }
      });
    });

    // Format the response
    const formattedOutlet = {
      ...updatedOutlet,
      cuisines: updatedOutlet?.cuisines.map(oc => ({
        cuisine: oc.cuisine
      })) || []
    };

    return NextResponse.json(formattedOutlet);
  } catch (error) {
    console.error('Error updating outlet:', error);
    return NextResponse.json(
      { error: 'Failed to update outlet' },
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
        { error: 'Valid outlet ID is required' },
        { status: 400 }
      );
    }

    // Check if outlet exists and get related counts
    const outlet = await prisma.outlet.findUnique({
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

    if (!outlet) {
      return NextResponse.json(
        { error: 'Outlet not found' },
        { status: 404 }
      );
    }

    // Prevent deletion if there are associated menus or orders
    if (outlet._count.menus > 0 || outlet._count.orders > 0) {
      return NextResponse.json(
        { 
          error: 'Cannot delete outlet with associated menus or orders',
          hasMenus: outlet._count.menus > 0,
          hasOrders: outlet._count.orders > 0
        },
        { status: 400 }
      );
    }

    // Delete the outlet (this will cascade to OutletCuisine due to Prisma's referential actions)
    await prisma.outlet.delete({
      where: { id: parseInt(id) }
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting outlet:', error);
    return NextResponse.json(
      { error: 'Failed to delete outlet' },
      { status: 500 }
    );
  }
}