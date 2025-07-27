'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Loader2, MapPin, Navigation, CheckCircle, XCircle, Clock } from 'lucide-react';

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

interface DeliveryDetails {
  id: number;
  status: string;
  order: {
    id: number;
    orderNumber: string;
    customer: {
      id: number;
      name: string;
      phone: string;
      address: string;
      location: string | null; // Keep as string for storage, but parse when needed
    };
    outlet: {
      id: number;
      name: string;
      address: string;
      location: string | null; // Keep as string for storage, but parse when needed
    };
  };
}

export default function LiveLocationSharing({ params }: { params: { deliveryId: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [otp, setOtp] = useState('');
  const [showOtpForm, setShowOtpForm] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [pickupLocation, setPickupLocation] = useState<Location | null>(null);
  const [dropoffLocation, setDropoffLocation] = useState<Location | null>(null);
  const [route, setRoute] = useState<Array<[number, number]>>([]);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [routeDuration, setRouteDuration] = useState<number | null>(null);
  const [deliveryDetails, setDeliveryDetails] = useState<DeliveryDetails | null>(null);
  const [activeTab, setActiveTab] = useState<'map' | 'details'>('map');
  const [isNavigating, setIsNavigating] = useState(false);
  const watchId = useRef<number | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState('');
  const [serviceWorkerRegistered, setServiceWorkerRegistered] = useState(false);
  const [isLocationPermissionGranted, setIsLocationPermissionGranted] = useState(false);

  // Helper function to parse location from string or object
  const parseLocation = (location: string | { lat: number; lng: number } | null | undefined) => {
    if (!location) return null;
    
    // If it's already an object with lat and lng
    if (typeof location === 'object' && 'lat' in location && 'lng' in location) {
      return { lat: location.lat, lng: location.lng };
    }
    
    // If it's a string in "lat,lng" format
    if (typeof location === 'string') {
      const [lat, lng] = location.split(',').map(Number);
      if (!isNaN(lat) && !isNaN(lng)) {
        return { lat, lng };
      }
    }
    
    return null;
  };

  // Helper function to safely render location
  const renderLocation = (location: any, fallback = 'Location not available') => {
    console.log('Rendering location:', location); // Debug log
    
    if (!location) return fallback;
    
    // If it's a string, return it directly
    if (typeof location === 'string') return location;
    
    // If it's an object with lat/lng, convert to string
    if (typeof location === 'object' && location !== null) {
      if ('lat' in location && 'lng' in location) {
        return `${location.lat},${location.lng}`;
      }
      // If it has an address property, use that
      if ('address' in location) return location.address;
    }
    
    // If we can't handle the format, return the fallback
    return fallback;
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
      
      if (savedDetails.order?.customer?.location) {
        const location = parseLocation(savedDetails.order.customer.location);
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
      const customerLocation = processLocation(data.order.customer?.location);
      
      // Update state with new data
      const updatedDetails = {
        ...data,
        _lastUpdated: new Date().toISOString(),
        order: {
          ...data.order,
          outlet: {
            ...data.order.outlet,
            location: outletLocation ? `${outletLocation.lat},${outletLocation.lng}` : data.order.outlet?.location
          },
          customer: {
            ...data.order.customer,
            location: customerLocation ? `${customerLocation.lat},${customerLocation.lng}` : data.order.customer?.location
          }
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

  // Format distance for display
  const formatDistance = (meters: number | null): string => {
    if (meters === null) return 'Calculating...';
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  };

  // Format duration for display
  const formatDuration = (seconds: number | null): string => {
    if (seconds === null) return 'Calculating...';
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  // Handle route updates from the Map component
  const handleRouteUpdate = useCallback((newRoute: Array<[number, number]>, distance: number, duration: number) => {
    setRoute(newRoute);
    setRouteDistance(distance);
    setRouteDuration(duration);
  }, []);

  // Calculate route between points
  const calculateRoute = useCallback(async (origin: Location, destination: Location) => {
    try {
      // In a real app, you would use a routing service like Mapbox, Google Maps, or OSRM
      // This is a simplified version that just returns a straight line
      setRoute([
        [origin.lng, origin.lat],
        [destination.lng, destination.lat]
      ]);
      
      // In a real implementation, you would call a routing API here
      // const response = await fetch(`/api/route?origin=${origin.lng},${origin.lat}&destination=${destination.lng},${destination.lat}`);
      // const routeData = await response.json();
      // setRoute(routeData.routes[0].geometry.coordinates);
    } catch (error) {
      console.error('Error calculating route:', error);
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
    if (currentLocation && dropoffLocation && deliveryDetails?.status === 'PICKED_UP') {
      calculateRoute(currentLocation, dropoffLocation);
    }
  }, [currentLocation, dropoffLocation, deliveryDetails?.status, calculateRoute]);

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
    const otpValue = otpToVerify.trim();
    if (!otpValue) {
      toast({
        title: "Error",
        description: "Please enter OTP",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/deliveries/otp', {
        method: 'PUT',  // Changed from POST to PUT
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          otp: otpValue,
          deliveryId: params.deliveryId,
          checkOnly: false // Let the backend handle validation
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Invalid OTP');
      }

      // Check if the response indicates successful verification
      if (!data.success || !data.delivery) {
        throw new Error(data.error || 'Verification failed');
      }

      // Store the OTP for future use (2-hour validity)
      storeOtp(otpValue);
      
      // Update delivery details from the response
      if (data.delivery?.order) {
        const { order } = data.delivery;
        
        // Set pickup location (outlet)
        if (order.outlet?.address) {
          const location = parseLocation(order.outlet.address);
          if (location) {
            setPickupLocation(location);
          } else {
            console.warn('Could not parse outlet location:', order.outlet.address);
          }
        }

        // Set dropoff location (customer)
        if (order.customer?.location) {
          const location = parseLocation(order.customer.location);
          if (location) {
            setDropoffLocation(location);
          } else {
            console.warn('Could not parse customer location:', order.customer.location);
          }
        }

        // Update delivery details
        setDeliveryDetails({
          id: data.delivery.id,
          status: data.delivery.status,
          order: {
            id: order.id,
            orderNumber: order.orderNumber || `#${order.id}`,
            customer: {
              id: order.customer.id,
              name: order.customer.name,
              phone: order.customer.phone,
              address: order.customer.address || '',
              // Convert location to string if it's an object
              location: typeof order.customer.location === 'object' 
                ? `${order.customer.location.lat},${order.customer.location.lng}`
                : order.customer.location || ''
            },
            outlet: {
              id: order.outlet?.id || 0,
              name: order.outlet?.name || 'Unknown Outlet',
              address: order.outlet?.address || '',
              // Convert location to string if it's an object
              location: order.outlet?.address
            }
          }
        });
      }
      
      setIsVerified(true);
      setShowOtpForm(false);
      
      // Start location sharing after successful verification
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setCurrentLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude
            });
            setIsLocationPermissionGranted(true);
            
            // Start watching position
            const id = navigator.geolocation.watchPosition(
              (pos) => {
                updateLocation(pos);
              },
              (error) => {
                console.error('Error getting location:', error);
                toast({
                  title: "Location Error",
                  description: "Could not get your location. Please ensure location services are enabled.",
                  variant: "destructive",
                });
              },
              {
                enableHighAccuracy: true,
                maximumAge: 10000,
                timeout: 5000
              }
            );
            
            // Store watch ID for cleanup
            watchId.current = id;
            setIsSharing(true);
            
            // Start service worker for background tracking if available
            if ('serviceWorker' in navigator && serviceWorkerRegistered) {
              navigator.serviceWorker.ready.then(registration => {
                registration.active?.postMessage({
                  type: 'START_LOCATION_TRACKING',
                  deliveryId: params.deliveryId,
                  interval: 10000,
                  authToken: process.env.NEXT_PUBLIC_API_KEY
                });
              });
            }
          },
          (error) => {
            console.error('Error getting location:', error);
            toast({
              title: "Location Access Required",
              description: "Please enable location access to share your live location.",
              variant: "destructive",
            });
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          }
        );
      }
      
      toast({
        title: "Verification Successful",
        description: "You can now share your live location.",
      });
      
    } catch (error) {
      console.error('Error verifying OTP:', error);
      setError(error instanceof Error ? error.message : 'Failed to verify OTP');
      toast({
        title: "Verification Failed",
        description: error instanceof Error ? error.message : 'Failed to verify OTP',
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
    if (pickupLocation && !deliveryDetails?.status.includes('PICKED_UP')) {
      const distance = getDistance(newLocation, pickupLocation);
      if (distance < 50) { // Within 50 meters of pickup
        // Update delivery status to PICKED_UP
        updateDeliveryStatus('PICKED_UP');
      }
    }
    
    // If we have dropoff location and order is picked up, check if delivered
    if (dropoffLocation && deliveryDetails?.status === 'PICKED_UP') {
      const distance = getDistance(newLocation, dropoffLocation);
      if (distance < 30) { // Within 30 meters of dropoff
        // Update delivery status to DELIVERED
        updateDeliveryStatus('DELIVERED');
      }
    }
    
    // Send to server
    sendLocationToServer(newLocation.lat, newLocation.lng);
  }, [pickupLocation, dropoffLocation, deliveryDetails?.status]);

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
        // Ensure we don't overwrite the order details
        order: {
          ...prev?.order,
          ...(updatedData.order || {})
        }
      }));

      // Save to localStorage
      if (deliveryDetails) {
        const updatedDetails = {
          ...deliveryDetails,
          ...updatedData,
          order: {
            ...deliveryDetails.order,
            ...(updatedData.order || {})
          },
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

  // Render the map view
  const renderMapView = () => (
    <div className="relative h-full w-full">
      {currentLocation && (
        <div className="absolute top-4 left-0 right-0 z-10 px-4">
          <div className="bg-white rounded-lg shadow-lg p-4 max-w-md mx-auto">
            <div className="flex items-center space-x-2">
              <div className="flex-1">
                <div className="flex items-center text-sm text-gray-600 mb-1">
                  <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs mr-2">1</div>
                  <span>{deliveryDetails?.order?.outlet?.name || 'Pickup Location'}</span>
                </div>
                <div className="text-xs text-gray-500 ml-8 mb-2">
                  {renderLocation(deliveryDetails?.order?.outlet?.location, deliveryDetails?.order?.outlet?.address || 'Location not available')}
                </div>
                
                <div className="h-6 border-l-2 border-gray-300 ml-3 my-1"></div>
                
                <div className="flex items-center text-sm text-gray-600">
                  <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white text-xs mr-2">2</div>
                  <span>{deliveryDetails?.order?.customer?.name || 'Drop-off Location'}</span>
                </div>
                <div className="text-xs text-gray-500 ml-8">
                  {renderLocation(deliveryDetails?.order?.customer?.location, deliveryDetails?.order?.customer?.address || 'Location not available')}
                </div>
              </div>
              
              <div className="flex flex-col space-y-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-8 w-8 p-0"
                  onClick={() => {
                    if (pickupLocation) {
                      window.open(`https://www.google.com/maps/dir/?api=1&destination=${pickupLocation.lat},${pickupLocation.lng}`);
                    }
                  }}
                  title="Navigate to pickup"
                >
                  <Navigation className="h-4 w-4" />
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-8 w-8 p-0"
                  onClick={() => {
                    if (dropoffLocation) {
                      window.open(`https://www.google.com/maps/dir/?api=1&destination=${dropoffLocation.lat},${dropoffLocation.lng}`);
                    }
                  }}
                  title="Navigate to dropoff"
                >
                  <MapPin className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="h-full w-full">
        <MapWithNoSSR
          currentLocation={currentLocation}
          pickupLocation={pickupLocation}
          dropoffLocation={deliveryDetails?.status === 'PICKED_UP' ? dropoffLocation : null}
          route={route}
          onRouteUpdate={handleRouteUpdate}
        />
      </div>
      
      {/* Bottom action bar */}
      <div className="absolute bottom-4 left-0 right-0 z-10 px-4">
        <div className="bg-white rounded-lg shadow-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="font-medium">
                {!deliveryDetails?.status.includes('PICKED_UP') 
                  ? "Head to pickup location"
                  : "Deliver to customer"}
              </h3>
              <p className="text-sm text-gray-500">
                {deliveryDetails?.order?.orderNumber ? `Order #${deliveryDetails.order.orderNumber}` : ''}
              </p>
            </div>
            
            {deliveryDetails?.status === 'PICKED_UP' ? (
              <Button 
                onClick={() => updateDeliveryStatus('DELIVERED')}
                className="bg-green-500 hover:bg-green-600"
              >
                Mark as Delivered
              </Button>
            ) : (
              <Button 
                onClick={() => updateDeliveryStatus('PICKED_UP')}
                disabled={!pickupLocation || !currentLocation || getDistance(currentLocation, pickupLocation) > 50}
              >
                Pickup Complete
              </Button>
            )}
          </div>
          
          {currentLocation && pickupLocation && (
            <div className="mt-2 text-sm text-gray-500">
              <div className="flex items-center">
                <Clock className="h-4 w-4 mr-1" />
                <span>
                  {!deliveryDetails?.status.includes('PICKED_UP')
                    ? `${Math.round(getDistance(currentLocation, pickupLocation))}m to pickup`
                    : dropoffLocation 
                      ? `${Math.round(getDistance(currentLocation, dropoffLocation))}m to dropoff`
                      : 'Calculating...'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Render the delivery details view
  const renderDetailsView = () => (
    <div className="p-4">
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Order Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-500">Order Number</h4>
              <p>{deliveryDetails?.order?.orderNumber || 'N/A'}</p>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-gray-500">Status</h4>
              <div className="flex items-center">
                {deliveryDetails?.status === 'DELIVERED' ? (
                  <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                ) : deliveryDetails?.status === 'CANCELLED' ? (
                  <XCircle className="h-4 w-4 text-red-500 mr-1" />
                ) : (
                  <div className="h-2 w-2 rounded-full bg-blue-500 mr-2 animate-pulse"></div>
                )}
                <span className="capitalize">
                  {deliveryDetails?.status?.toLowerCase().replace('_', ' ') || 'Processing'}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Customer Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-500">Name</h4>
              <p>{deliveryDetails?.order?.customer?.name || 'N/A'}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-500">Address</h4>
              <p>{deliveryDetails?.order?.customer?.address || 'N/A'}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-500">Delivery location</h4>
              <p>{renderLocation(deliveryDetails?.order?.customer?.location, deliveryDetails?.order?.customer?.address || 'Location not available')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Outlet Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-500">Name</h4>
              <p>{deliveryDetails?.order?.outlet?.name || 'N/A'}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-500">Pickup Location</h4>
              <p>{renderLocation(deliveryDetails?.order?.outlet?.location, deliveryDetails?.order?.outlet?.address || 'Location not available')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // OTP Verification Form
  if (showOtpForm) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
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
  }

  // Main delivery tracking view
  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold">
            {deliveryDetails?.order?.outlet?.name || 'Delivery'}
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
      
      {/* Main content */}
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