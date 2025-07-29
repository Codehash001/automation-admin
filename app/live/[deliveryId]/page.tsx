'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Loader2, MapPin, Navigation, CheckCircle, XCircle, Clock, MessageCircle, CheckCircle2 } from 'lucide-react';

// Dynamically import the Map component to avoid SSR issues
const MapWithNoSSR = dynamic(
  () => import('@/components/map'),
  { ssr: false }
);

interface Location {
  lat: number;
  lng: number;
  address?: string;
}

interface Emirates {
  id: number;
  name: string;
  // Add other emirates fields as needed
}

interface Customer {
  id: number;
  name: string;
  whatsappNumber: string;
  // Note: These come from delivery.order level in the API
  // deliveryAddress: string;
  // deliveryLocation: string;
}

interface Outlet {
  id: number;
  name: string;
  exactLocation: string; // This is the address string
  location: string | null; // This is the "lat,lng" string
}

interface Order {
  id: number;
  status: string;
  orderNumber: string;
  customer: Customer;
  outlet: Outlet | null;
  deliveryAddress: string;
  deliveryLocation: string | null;
  emirates: Emirates | null;
  createdAt: string;
  updatedAt: string;
}

interface Driver {
  id: number;
  name: string;
  phone: string;
  liveLocation: string | null; // "lat,lng" format
}

interface CompleteDeliveryDetails {
  id: number;
  status: string;
  driver: Driver | null;
  order: Order;
  createdAt: string;
  updatedAt: string;
}

interface RouteInfo {
  coordinates: Array<[number, number]>;
  distance: number;
  duration: number;
}

export default function LiveLocationSharing({ params }: { params: { deliveryId: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const watchIdRef = useRef<number | null>(null);
  
  // Core delivery details states
  const [deliveryDetails, setDeliveryDetails] = useState<CompleteDeliveryDetails | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [pickupLocation, setPickupLocation] = useState<Location | null>(null);
  const [dropoffLocation, setDropoffLocation] = useState<Location | null>(null);
  
  // Route state
  const [routeInfo, setRouteInfo] = useState<RouteInfo>({ coordinates: [], distance: 0, duration: 0 });
  
  // State for pickup and dropoff info
  const [pickupInfo, setPickupInfo] = useState({ distance: 0, duration: 0 });
  const [dropoffInfo, setDropoffInfo] = useState({ distance: 0, duration: 0 });

  const [activeTab, setActiveTab] = useState<'map' | 'details'>('map');
  const [isNavigating, setIsNavigating] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [serviceWorkerRegistered, setServiceWorkerRegistered] = useState(false);
  const [isLocationPermissionGranted, setIsLocationPermissionGranted] = useState(false);
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [pickedUp, setPickedUp] = useState(false);
  const [showRoute, setShowRoute] = useState(false);
  const [isOrderPickedUp, setIsOrderPickedUp] = useState(false);

  // Helper function to parse location from string or object
  const parseLocation = (location: any): { lat: number; lng: number } | null => {
    if (!location) return null;
    
    // If it's already in the correct format
    if (typeof location === 'object' && 'lat' in location && 'lng' in location) {
      return {
        lat: parseFloat(location.lat),
        lng: parseFloat(location.lng)
      };
    }
    
    // If it's a string in "lat,lng" format
    if (typeof location === 'string' && location.includes(',')) {
      const [lat, lng] = location.split(',').map(coord => parseFloat(coord.trim()));
      if (!isNaN(lat) && !isNaN(lng)) {
        return { lat, lng };
      }
    }
    
    return null;
  };

  // Helper function to safely render location
  const renderLocation = (location: any, fallback: string = 'Location not available') => {
    if (!location) return fallback;
    
    // If it's a string, return it directly
    if (typeof location === 'string') return location;
    
    // If it's an object with lat and lng, format it
    if (typeof location === 'object' && location !== null) {
      if ('lat' in location && 'lng' in location) {
        return `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`;
      }
      if ('address' in location) {
        return location.address;
      }
    }
    
    // Fallback for any other case
    return fallback;
  };

  // Format distance in kilometers or meters
  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  };

  // Format duration in minutes or hours
  const formatDuration = (seconds: number) => {
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  // Update the useEffect for localStorage
  useEffect(() => {
    // Function to load saved data
    const loadSavedData = () => {
      const savedData = localStorage.getItem(`deliveryDetails_${params.deliveryId}`);
      if (!savedData) return null;
      
      try {
        return JSON.parse(savedData);
      } catch (error) {
        console.error('Error parsing saved delivery details:', error);
        localStorage.removeItem(`deliveryDetails_${params.deliveryId}`);
        return null;
      }
    };

    // Load and set the saved data
    const savedDetails = loadSavedData();
    if (savedDetails) {
      setDeliveryDetails(savedDetails);
      
      // Restore locations if they exist
      if (savedDetails.order?.outlet?.location) {
        const location = parseLocation(savedDetails.order.outlet.location);
        if (location) setPickupLocation(location);
      }
      
      if (savedDetails.order?.deliveryLocation) {
        const location = parseLocation(savedDetails.order.deliveryLocation);
        if (location) setDropoffLocation(location);
      }
    }

    // Always fetch fresh data from the API
    fetchDeliveryDetails().catch(console.error);

    // Set up beforeunload handler
    const handleBeforeUnload = () => {
      if (deliveryDetails) {
        const dataToSave = {
          ...deliveryDetails,
          // Ensure we're not saving any functions or circular references
          _timestamp: new Date().toISOString()
        };
        localStorage.setItem(
          `deliveryDetails_${params.deliveryId}`, 
          JSON.stringify(dataToSave)
        );
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Save current state when component unmounts
      handleBeforeUnload();
    };
  }, [params.deliveryId]);

  // Update the fetchDeliveryDetails function to include error details in the saved data
  const fetchDeliveryDetails = useCallback(async () => {
    try {
      const response = await fetch(`/api/deliveries?id=${params.deliveryId}`, {
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_API_KEY}`,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to fetch delivery details');
      }
      
      const data = await response.json();
      
      if (!data || !data.order) {
        console.error('Invalid data format from API:', data);
        throw new Error('Invalid data received from server');
      }
      
      // Process locations
      const processLocation = (locationData: any) => {
        if (!locationData) return null;
        const parsed = parseLocation(locationData);
        return parsed ? parsed : null;
      };
      
      const outletLocation = processLocation(data.order.outlet?.location);
      const customerLocation = processLocation(data.order.deliveryLocation);
      
      // Update state with new data
      const updatedDetails: CompleteDeliveryDetails = {
        ...data,
        _lastUpdated: new Date().toISOString(),
        order: {
          ...data.order,
          outlet: {
            ...data.order.outlet,
            location: outletLocation ? `${outletLocation.lat},${outletLocation.lng}` : data.order.outlet?.location
          },
          deliveryLocation: customerLocation ? `${customerLocation.lat},${customerLocation.lng}` : data.order.deliveryLocation
        }
      };
      
      // Update state and save to localStorage
      setDeliveryDetails(updatedDetails);
      localStorage.setItem(
        `deliveryDetails_${params.deliveryId}`, 
        JSON.stringify(updatedDetails)
      );
      
      // Update location states
      if (outletLocation) setPickupLocation(outletLocation);
      if (customerLocation) setDropoffLocation(customerLocation);
      
      return updatedDetails;
      
    } catch (error) {
      console.error('Error in fetchDeliveryDetails:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load delivery details",
        variant: "destructive",
      });
      
      // Try to load from localStorage as fallback
      const savedData = localStorage.getItem(`deliveryDetails_${params.deliveryId}`);
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          setDeliveryDetails(parsed);
          return parsed;
        } catch (e) {
          console.error('Error loading fallback data:', e);
        }
      }
      
      throw error;
    }
  }, [params.deliveryId]);

  // Handle route updates from the Map component
  const handleRouteUpdate = useCallback((newRoute: { coordinates: Array<[number, number]>; distance: number; duration: number }) => {
    setRouteInfo(newRoute);
  }, []);

  // Handle distance/duration updates
  const handleDistanceUpdate = (distance: number, duration: number, type: 'pickup' | 'dropoff') => {
    if (type === 'pickup') {
      setPickupInfo({ distance, duration });
    } else {
      setDropoffInfo({ distance, duration });
    }
  };

  // Calculate route between points
  const calculateRoute = useCallback(async (origin: Location, destination: Location) => {
    try {
      // In a real app, you would use a routing service like Mapbox, Google Maps, or OSRM
      // This is a simplified version that just returns a straight line
      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}` +
        `?geometries=geojson&access_token=${process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch route');
      }
      
      const data = await response.json();
      
      if (data.routes && data.routes[0]) {
        const route = data.routes[0];
        const coordinates = route.geometry.coordinates.map((coord: number[]) => 
          [coord[0], coord[1]] as [number, number]
        );
        
        setRouteInfo({
          coordinates,
          distance: route.distance,
          duration: route.duration
        });
        
        return coordinates;
      }
    } catch (error) {
      console.error('Error calculating route:', error);
      // Don't fall back to straight line - just keep the last good route
    }
  }, []);

  // Fetch delivery details on component mount
  useEffect(() => {
    if (isVerified) {
      fetchDeliveryDetails();
    }
  }, [isVerified, fetchDeliveryDetails]);

  // Calculate route when both pickup and current location are available
  useEffect(() => {
    if (currentLocation && pickupLocation) {
      calculateRoute(currentLocation, pickupLocation);
    }
  }, [currentLocation, pickupLocation, calculateRoute]);

  // Update route when dropoff is available and pickup is reached
  useEffect(() => {
    if (currentLocation && dropoffLocation && deliveryDetails?.order?.status === 'PICKED_UP') {
      calculateRoute(currentLocation, dropoffLocation);
    }
  }, [currentLocation, dropoffLocation, deliveryDetails?.order?.status, calculateRoute]);

  // Check for existing valid OTP in localStorage on component mount
  useEffect(() => {
    const checkExistingOtp = async () => {
      const storedOtpData = localStorage.getItem(`delivery_otp_${params.deliveryId}`);
      
      if (storedOtpData) {
        const { otp, timestamp } = JSON.parse(storedOtpData);
        const now = new Date().getTime();
        const twoHoursInMs = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
        
        // Check if OTP is still valid (less than 2 hours old)
        if (now - timestamp < twoHoursInMs) {
          setOtp(otp);
          await verifyOtp(otp);
          return true;
        } else {
          // Clear expired OTP
          localStorage.removeItem(`delivery_otp_${params.deliveryId}`);
        }
      }
      return false;
    };

    // Check URL for OTP first, then localStorage
    const otpParam = searchParams.get('otp');
    if (otpParam) {
      setOtp(otpParam);
      verifyOtp(otpParam);
    } else {
      checkExistingOtp();
    }
  }, [searchParams, params.deliveryId]);

  // Store OTP in localStorage when verified
  const storeOtp = (otp: string) => {
    const otpData = {
      otp,
      timestamp: new Date().getTime()
    };
    localStorage.setItem(`delivery_otp_${params.deliveryId}`, JSON.stringify(otpData));
  };

  // Clear stored OTP
  const clearStoredOtp = () => {
    localStorage.removeItem(`delivery_tp_${params.deliveryId}`);
  };

  // Verify OTP and start delivery tracking
  const verifyOtp = async (otpToVerify: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/deliveries/otp`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_API_KEY}`
        },
        body: JSON.stringify({
          deliveryId: params.deliveryId,
          otp: otpToVerify
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to verify OTP');
      }

      const { delivery } = await response.json();
      
      if (!delivery) {
        throw new Error('Invalid response from server');
      }

      // Set the complete delivery details
      setDeliveryDetails(delivery);

      // Parse and set locations for the map
      if (delivery.driver?.liveLocation) {
        const [lat, lng] = delivery.driver.liveLocation.split(',').map(Number);
        if (!isNaN(lat) && !isNaN(lng)) {
          setCurrentLocation({ lat, lng });
        }
      }

      // Parse pickup location (from outlet)
      console.log('Outlet data:', delivery.order?.outlet);
      if (delivery.order?.outlet) {
        console.log('Outlet location:', delivery.order.outlet.location);
        console.log('Outlet address:', delivery.order.outlet.address);
        
        let lat: number | null = null;
        let lng: number | null = null;
        
        // Check if location is available as a string
        if (delivery.order.outlet.location) {
          console.log('Using outlet.location for coordinates');
          [lat, lng] = delivery.order.outlet.location.split(',').map(Number);
        } 
        // Check if address is an object with lat/lng
        else if (delivery.order.outlet.address && typeof delivery.order.outlet.address === 'object') {
          console.log('Using outlet.address object for coordinates');
          lat = parseFloat(delivery.order.outlet.address.lat);
          lng = parseFloat(delivery.order.outlet.address.lng);
        }
        // Fallback to address as string if it contains coordinates
        else if (typeof delivery.order.outlet.address === 'string' && delivery.order.outlet.address.includes(',')) {
          console.log('Using outlet.address string for coordinates');
          [lat, lng] = delivery.order.outlet.address.split(',').map(Number);
        }
        
        console.log('Parsed coordinates:', { lat, lng });
        
        if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
          const pickupAddress = delivery.order.outlet.exactLocation || 
                             (typeof delivery.order.outlet.address === 'string' ? delivery.order.outlet.address : '') || 
                             'Pickup location';
          console.log('Setting pickup location:', { lat, lng, address: pickupAddress });
          setPickupLocation({
            lat,
            lng,
            address: pickupAddress
          });
        } else {
          console.error('Failed to parse coordinates from outlet data');
        }
      } else {
        console.error('No outlet data available in delivery.order');
      }

      // Parse dropoff location
      if (delivery.order?.deliveryLocation) {
        const [lat, lng] = delivery.order.deliveryLocation.split(',').map(Number);
        if (!isNaN(lat) && !isNaN(lng)) {
          setDropoffLocation({
            lat,
            lng,
            address: delivery.order.deliveryAddress || 'Dropoff location'
          });
        }
      }

      // Store in localStorage for persistence
      localStorage.setItem(`delivery_${delivery.id}`, JSON.stringify({
        ...delivery,
        _lastUpdated: new Date().toISOString()
      }));

      // Start location tracking
      await startLocationTracking();
      
      // Mark as verified
      setIsVerified(true);
      
      toast({
        title: "OTP Verified",
        description: "Delivery details loaded successfully.",
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to verify OTP';
      console.error('OTP Verification Error:', error);
      toast({
        title: "Verification Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Update location function
  const updateLocation = useCallback((position: GeolocationPosition) => {
    const newLocation = {
      lat: position.coords.latitude,
      lng: position.coords.longitude
    };
    
    setCurrentLocation(newLocation);
    
    // If we have pickup location, check if we've reached it
    if (pickupLocation && !deliveryDetails?.order?.status.includes('PICKED_UP')) {
      const distance = getDistance(newLocation, pickupLocation);
      if (distance < 50) { // Within 50 meters of pickup
        // Update delivery status to PICKED_UP
        updateDeliveryStatus('PICKED_UP');
      }
    }
    
    // If we have dropoff location and order is picked up, check if delivered
    if (dropoffLocation && deliveryDetails?.order?.status === 'PICKED_UP') {
      const distance = getDistance(newLocation, dropoffLocation);
      if (distance < 30) { // Within 30 meters of dropoff
        // Update delivery status to DELIVERED
        updateDeliveryStatus('DELIVERED');
      }
    }
    
    // Send to server
    sendLocationToServer(newLocation.lat, newLocation.lng);
  }, [pickupLocation, dropoffLocation, deliveryDetails?.order?.status]);

  // Helper function to calculate distance between two points in meters
  const getDistance = (loc1: Location, loc2: Location) => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = loc1.lat * Math.PI / 180;
    const φ2 = loc2.lat * Math.PI / 180;
    const Δφ = (loc2.lat - loc1.lat) * Math.PI / 180;
    const Δλ = (loc2.lng - loc1.lng) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  };

  // Update delivery status
  const updateDeliveryStatus = async (status: string) => {
    try {
      const response = await fetch(`/api/deliveries`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: parseInt(params.deliveryId),
          status
        })
      });
      
      if (!response.ok) throw new Error('Failed to update delivery status');
      
      const data = await response.json();
      setDeliveryDetails(prev => prev ? { ...prev, status } : null);
      
      toast({
        title: status === 'PICKED_UP' ? "Order Picked Up" : "Order Delivered",
        description: status === 'PICKED_UP' 
          ? "You've picked up the order. Head to the delivery location."
          : "Delivery completed successfully!",
      });
      
      return data;
      
    } catch (error) {
      console.error('Error updating delivery status:', error);
      toast({
        title: "Error",
        description: "Failed to update delivery status. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Send location updates to the server
  const sendLocationToServer = async (lat: number, lng: number) => {
    try {
      const response = await fetch('/api/deliveries', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_API_KEY}`
        },
        body: JSON.stringify({
          id: parseInt(params.deliveryId),
          liveLocation: {
            latitude: lat,
            longitude: lng,
            updatedAt: new Date().toISOString()
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update location');
      }

      const updatedData = await response.json();
      
      // Update the local state with the server response
      setDeliveryDetails(prev => ({
        ...prev,
        ...updatedData,
        _lastUpdated: new Date().toISOString()
      }));

      // Save to localStorage
      if (deliveryDetails) {
        const updatedDetails = {
          ...deliveryDetails,
          ...updatedData,
          _lastUpdated: new Date().toISOString()
        };
        localStorage.setItem(
          `deliveryDetails_${params.deliveryId}`, 
          JSON.stringify(updatedDetails)
        );
      }

      return updatedData;
    } catch (error) {
      console.error('Error sending location to server:', error);
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update your location. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  // Start location tracking
  const startLocationTracking = useCallback(() => {
    if (!navigator.geolocation) {
      toast({
        title: "Location Error",
        description: "Geolocation is not supported by your browser",
        variant: "destructive",
      });
      return;
    }

    // Get current position first
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const newLocation = { lat: latitude, lng: longitude };
        setCurrentLocation(newLocation);
        setIsLocationPermissionGranted(true);
        
        // Start watching position
        const watchId = navigator.geolocation.watchPosition(
          (pos) => {
            const { latitude, longitude } = pos.coords;
            const updatedLocation = { lat: latitude, lng: longitude };
            setCurrentLocation(updatedLocation);
            
            // Send location to server
            sendLocationToServer(latitude, longitude);
          },
          (error) => {
            console.error('Error getting location:', error);
            // Don't show repeated timeout errors to avoid spamming the user
            if (error.code !== error.TIMEOUT) {
              let errorMessage = 'Could not get your location. ';
              
              if (error.code === error.PERMISSION_DENIED) {
                errorMessage += 'Please enable location access in your browser settings.';
              } else if (error.code === error.POSITION_UNAVAILABLE) {
                errorMessage += 'Location information is unavailable.';
              } else {
                errorMessage += 'Trying again...';
              }
              
              toast({
                title: "Location Error",
                description: errorMessage,
                variant: "destructive",
              });
            }
          },
          {
            enableHighAccuracy: true,
            maximumAge: 10000,  // Accept a position whose age is no greater than 10 seconds
            timeout: 10000,     // 10 second timeout
          }
        );
        
        // Store watch ID for cleanup
        watchIdRef.current = watchId;
        setIsSharing(true);
        
        // Start service worker for background tracking if available
        if ('serviceWorker' in navigator && serviceWorkerRegistered) {
          navigator.serviceWorker.ready.then(registration => {
            registration.active?.postMessage({
              type: 'START_LOCATION_TRACKING',
              deliveryId: params.deliveryId,
              interval: 10000,  // 10 seconds
              authToken: process.env.NEXT_PUBLIC_API_KEY
            });
          });
        }
      },
      (error) => {
        console.error('Error getting initial location:', error);
        let errorMessage = 'Could not get your location. ';
        
        if (error.code === error.TIMEOUT) {
          errorMessage = 'Location request timed out. Please check your location settings and try again.';
        } else if (error.code === error.PERMISSION_DENIED) {
          errorMessage = 'Location permission denied. Please enable location access in your browser settings.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMessage = 'Location information is unavailable.';
        }
        
        toast({
          title: "Location Error",
          description: errorMessage,
          variant: "destructive",
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,  // 10 seconds
        maximumAge: 0    // Force fresh position
      }
    );
  }, [params.deliveryId, serviceWorkerRegistered]);

  // Cleanup function for location tracking
  const stopLocationTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsSharing(false);
    
    // Stop background tracking if service worker is active
    if ('serviceWorker' in navigator && serviceWorkerRegistered) {
      navigator.serviceWorker.ready.then(registration => {
        registration.active?.postMessage({
          type: 'STOP_LOCATION_TRACKING'
        });
      });
    }
  }, [serviceWorkerRegistered]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopLocationTracking();
    };
  }, [stopLocationTracking]);

  // Helper function to safely render location
  const getLocationString = (location: any): string => {
    if (!location) return 'Location not available';
    
    // Handle string format "lat,lng"
    if (typeof location === 'string' && location.includes(',')) {
      return location;
    }
    
    // Handle object with lat/lng
    if (typeof location === 'object' && location !== null) {
      if ('lat' in location && 'lng' in location) {
        return `${location.lat}, ${location.lng}`;
      }
      if ('address' in location) {
        return location.address;
      }
    }
    
    // Fallback to string representation
    return String(location);
  };

  // Function to handle delivery status update
  const handleDeliveryStatusUpdate = async (status: 'PICKED_UP' | 'DELIVERED') => {
    try {
      setIsLoading(true);
      
      // Update delivery status
      await updateDeliveryStatus(status);
      
      // If status is DELIVERED, show WhatsApp button
      if (status === 'PICKED_UP') {
        toast({
          title: "Order Picked Up",
          description: "Order has been marked as picked up. Proceed to delivery location.",
        });
      }
      
    } catch (error) {
      console.error('Error updating delivery status:', error);
      toast({
        title: "Error",
        description: "Failed to update delivery status. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Function to open WhatsApp with delivery confirmation
  const openWhatsAppConfirmation = () => {
    if (!deliveryDetails?.order?.customer?.whatsappNumber) {
      toast({
        title: "Error",
        description: "Customer WhatsApp number not available.",
        variant: "destructive",
      });
      return;
    }
    
    const message = `Delivery #${deliveryDetails.order.orderNumber} has been successfully delivered. Thank you for your order!`;
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${deliveryDetails.order.customer.whatsappNumber}?text=${encodedMessage}`;
    
    window.open(whatsappUrl, '_blank');
  };

  // Render the map view
  const renderMapView = () => {
    if (!deliveryDetails || !pickupLocation) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="text-lg font-medium">Loading map data...</p>
            {!pickupLocation && <p className="text-sm text-gray-500 mt-2">Loading pickup location...</p>}
            {!dropoffLocation && <p className="text-sm text-gray-500 mt-2">Loading dropoff location...</p>}
          </div>
        </div>
      );
    }
    
    const currentInfo = pickedUp ? dropoffInfo : pickupInfo;
    const destinationName = pickedUp 
      ? deliveryDetails?.order?.customer?.name || 'Customer'
      : deliveryDetails?.order?.outlet?.name || 'Pickup location';

    return (
      <div className="h-full w-full relative flex flex-col">
        {/* Top Delivery Info Card */}
        <div className="bg-white shadow-md rounded-b-lg mx-4 mt-2 z-10">
          <div className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <div className={`h-2 w-2 rounded-full ${pickedUp ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                  <h3 className="font-medium text-gray-900">
                    {pickedUp ? 'Delivering to' : 'Picking up from'} <span className="font-semibold">{destinationName}</span>
                  </h3>
                </div>
                
                {/* Distance and ETA */}
                <div className="mt-2 flex items-center space-x-4 text-sm">
                  <div className="flex items-center">
                    <svg className="h-4 w-4 text-gray-500 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>{formatDistance(currentInfo.distance)}</span>
                  </div>
                  <div className="flex items-center">
                    <svg className="h-4 w-4 text-gray-500 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{formatDuration(currentInfo.duration)}</span>
                  </div>
                </div>
              </div>
              
              <span className={`text-xs px-2 py-1 rounded-full ${
                deliveryDetails?.status === 'DELIVERED' ? 'bg-green-100 text-green-800' :
                deliveryDetails?.status === 'IN_TRANSIT' ? 'bg-blue-100 text-blue-800' :
                'bg-yellow-100 text-yellow-800'}
              `}>
                {deliveryDetails?.status?.replace('_', ' ') || 'PENDING'}
              </span>
            </div>
            
            {!pickedUp && (
              <button
                onClick={handlePickedUp}
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium mt-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </span>
                ) : (
                  'Confirm as Picked Up'
                )}
              </button>
            )}
            
            {isOrderPickedUp && (
              <button
                onClick={handleWhatsAppConfirmation}
                className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium mt-3 flex items-center justify-center"
              >
                <MessageCircle className="mr-2 h-4 w-4 text-white" />
                Confirm Delivery in WhatsApp
              </button>
            )}
          </div>
        </div>
        
        {/* Map Container */}
        <div className="flex-1 relative">
          <MapWithNoSSR
            currentLocation={currentLocation}
            pickupLocation={!pickedUp ? pickupLocation : null}
            dropoffLocation={pickedUp ? dropoffLocation : null}
            route={routeInfo.coordinates}
            onRouteUpdate={handleRouteUpdate}
            onDistanceUpdate={handleDistanceUpdate}
            showPickupRoute={!pickedUp}
            showDropoffRoute={pickedUp}
          />
        </div>
      </div>
    );
  };

  // Render the details view
  const renderDetailsView = () => {
    if (!deliveryDetails) return null;
    
    return (
      <div className="p-4 overflow-y-auto h-full">
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <h3 className="font-medium mb-3">Order Information</h3>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-500">Order Number</p>
              <p className="font-medium">{deliveryDetails.order.id}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <p className="font-medium">{deliveryDetails.status}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <h3 className="font-medium mb-3">Customer Details</h3>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-500">Delivery Address</p>
              <p className="font-medium">{deliveryDetails.order.customer.name}</p>
              <p className="font-medium">{deliveryDetails.order.deliveryAddress}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-medium mb-3">Outlet Details</h3>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-500">Name</p>
              <p className="font-medium">{deliveryDetails.order.outlet?.name}</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render OTP form
  const renderOtpForm = () => (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Verify Delivery</CardTitle>
          <p className="text-sm text-gray-500">
            Enter the OTP sent to your WhatsApp number to start the delivery
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="otp">OTP</Label>
              <Input
                id="otp"
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Enter 6-digit OTP"
                className="mt-1"
              />
            </div>
            
            <Button 
              onClick={() => verifyOtp(otp)}
              disabled={isLoading || otp.length < 4}
              className="w-full"
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Verify & Start Delivery
            </Button>
            
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Add these functions with other helper functions, before the return statement
  const handlePickedUp = useCallback(async () => {
    try {
      setIsLoading(true);
      await updateDeliveryStatus('IN_TRANSIT');
      setPickedUp(true);
      setIsOrderPickedUp(true);
    } catch (error) {
      console.error('Error updating delivery status:', error);
      toast({
        title: "Error",
        description: "Failed to update delivery status. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [updateDeliveryStatus]);
  
  const handleWhatsAppConfirmation = useCallback(() => {
    const phoneNumber = '+971569719345';
    const message = `Delivery Confirmation: Order #${deliveryDetails?.order?.id || ''} has been delivered.`;
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  }, [deliveryDetails]);

  // Main render
  if (!isVerified || !deliveryDetails) {
    return renderOtpForm();
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100 overflow-hidden">
      <header className="bg-white shadow-sm z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold">
            {deliveryDetails.order.outlet?.name || 'Delivery'}
          </h1>
          <div className="flex space-x-2">
            <Button 
              variant={activeTab === 'map' ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => setActiveTab('map')}
            >
              Map
            </Button>
            <Button 
              variant={activeTab === 'details' ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => setActiveTab('details')}
            >
              Details
            </Button>
          </div>
        </div>
      </header>
      
      <main className="flex-1 overflow-hidden">
        {activeTab === 'map' ? renderMapView() : renderDetailsView()}
      </main>
      
      {/* Status bar */}
      <div className="bg-white border-t p-2 text-center text-sm text-gray-500">
        {isSharing ? (
          <div className="flex items-center justify-center">
            <div className="h-2 w-2 rounded-full bg-green-500 mr-2 animate-pulse"></div>
            <span>Sharing live location</span>
          </div>
        ) : (
          <span>Location sharing paused</span>
        )}
      </div>
    </div>
  );
}