'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, RefreshCw, MapPin, User, Truck, Car, Clock, Map } from 'lucide-react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { toast } from '@/hooks/use-toast';

// Set the access token
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '';

// Create a car icon for the marker using Lucide
const createCarIcon = () => {
  const icon = document.createElement('div');
  icon.className = 'car-marker';
  
  // Create SVG element
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '32');
  svg.setAttribute('height', '32');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  
  // Add car path
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 15.12V17h2');
  
  // Add circle for wheels
  const circle1 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle1.setAttribute('cx', '6.5');
  circle1.setAttribute('cy', '16.5');
  circle1.setAttribute('r', '2.5');
  
  const circle2 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle2.setAttribute('cx', '16.5');
  circle2.setAttribute('cy', '16.5');
  circle2.setAttribute('r', '2.5');
  
  svg.appendChild(path);
  svg.appendChild(circle1);
  svg.appendChild(circle2);
  
  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    .car-marker {
      transform: translate(-50%, -100%);
      color: #3B82F6;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
    }
  `;
  
  icon.appendChild(svg);
  document.head.appendChild(style);
  
  return icon;
};

// Delivery Map Component with Route Tracking
function DeliveryMap({ 
  riderLocation, 
  destination, 
  isLoading 
}: { 
  riderLocation: string | null, 
  destination: { lat: number; lng: number } | null,
  isLoading: boolean 
}) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const riderMarker = useRef<mapboxgl.Marker | null>(null);
  const destinationMarker = useRef<mapboxgl.Marker | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: number; duration: number } | null>(null);
  const userInteracted = useRef(false);

  // Create car marker
  const carMarker = useMemo(() => createCarIcon(), []);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [55.2708, 25.2048], // Default to Dubai
      zoom: 12,
      maxZoom: 18,
      minZoom: 10,
      pitch: 0,
      bearing: 0,
      interactive: true,
      trackResize: true,
      antialias: true
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl());

    // Track user interaction
    const handleInteraction = () => userInteracted.current = true;
    map.current.on('mousedown', handleInteraction);
    map.current.on('touchstart', handleInteraction);
    map.current.on('move', handleInteraction);

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Update rider marker and route when locations change
  useEffect(() => {
    if (!map.current || !riderLocation || !destination) return;

    try {
      const [riderLat, riderLng] = riderLocation.split(',').map(Number);
      if (isNaN(riderLat) || isNaN(riderLng)) return;

      // Update or create rider marker
      if (!riderMarker.current) {
        riderMarker.current = new mapboxgl.Marker({
          element: carMarker.cloneNode(true) as HTMLElement,
          rotationAlignment: 'map',
          pitchAlignment: 'auto'
        }).setLngLat([riderLng, riderLat]).addTo(map.current);
      } else {
        riderMarker.current.setLngLat([riderLng, riderLat]);
      }

      // Update route
      updateRoute([riderLng, riderLat], [destination.lng, destination.lat]);

      // Center map on rider if user hasn't interacted
      if (!userInteracted.current) {
        map.current.flyTo({
          center: [riderLng, riderLat],
          zoom: 15,
          essential: true
        });
      }
    } catch (error) {
      console.error('Error updating rider position:', error);
    }
  }, [riderLocation, destination]);

  // Update route between two points
  const updateRoute = useCallback(async (start: [number, number], end: [number, number]) => {
    if (!map.current) return;

    try {
      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/` +
        `${start[0]},${start[1]};${end[0]},${end[1]}` +
        `?geometries=geojson&overview=full&access_token=${mapboxgl.accessToken}`
      );

      const data = await response.json();
      if (!data.routes?.length) return;

      const route = data.routes[0];
      setRouteInfo({
        distance: Math.round(route.distance / 1000 * 10) / 10, // km with 1 decimal
        duration: Math.ceil(route.duration / 60) // minutes rounded up
      });

      // Update or create route line
      const source = map.current.getSource('route') as mapboxgl.GeoJSONSource;
      if (source) {
        source.setData({
          type: 'Feature',
          properties: {},
          geometry: route.geometry
        });
      } else {
        map.current.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: route.geometry
          }
        });

        map.current.addLayer({
          id: 'route',
          type: 'line',
          source: 'route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#3b82f6',
            'line-width': 4,
            'line-opacity': 0.7
          }
        });
      }
    } catch (error) {
      console.error('Error updating route:', error);
    }
  }, []);

  return (
    <div ref={mapContainer} className="w-full h-full relative">
      {!riderLocation && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
          <div className="bg-white p-4 rounded-lg shadow-lg">
            <p className="text-sm text-gray-700">Waiting for driver's location...</p>
          </div>
        </div>
      )}
      {routeInfo && (
        <div className="absolute bottom-24 left-4 bg-white p-3 rounded-lg shadow-md z-10">
          <div className="flex items-center space-x-2">
            <Clock className="h-5 w-5 text-blue-500" />
            <span className="font-medium">{routeInfo.duration} min</span>
            <span className="mx-2 text-gray-300">•</span>
            <Map className="h-5 w-5 text-blue-500" />
            <span className="font-medium">{routeInfo.distance} km</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ViewLiveUpdate({ params }: { params: { deliveryId: string } }) {
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [delivery, setDelivery] = useState<any>(null);
  const [isVerified, setIsVerified] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const refreshInterval = useRef<NodeJS.Timeout | null>(null);

  // Get destination from delivery data
  const destination = useMemo(() => {
    if (!delivery?.order?.customer?.location) return null;
    try {
      const [lat, lng] = delivery.order.customer.location.split(',').map(Number);
      return { lat, lng };
    } catch (e) {
      console.error('Error parsing destination location:', e);
      return null;
    }
  }, [delivery]);

  // Auto-refresh delivery data every 10 seconds
  const startAutoRefresh = useCallback(() => {
    if (refreshInterval.current) clearInterval(refreshInterval.current);
    refreshInterval.current = setInterval(fetchDeliveryData, 10000);
  }, []);

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (refreshInterval.current) {
        clearInterval(refreshInterval.current);
      }
    };
  }, []);

  // Check for OTP in URL
  useEffect(() => {
    const otpParam = searchParams.get('otp');
    if (otpParam) {
      setOtp(otpParam);
      verifyOtp(otpParam);
    }
  }, [searchParams]);

  const fetchDeliveryData = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      const response = await fetch(`/api/deliveries?id=${params.deliveryId}`, {
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_API_KEY}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch delivery data');
      
      const data = await response.json();
      setDelivery((prev: { driver: any; }) => ({
        ...prev,
        ...data,
        // Merge driver location updates without losing other driver data
        driver: data.driver ? { ...prev?.driver, ...data.driver } : prev?.driver
      }));
    } catch (error) {
      console.error('Error fetching delivery data:', error);
      if (!isVerified) return;
      
      toast({
        title: 'Error',
        description: 'Failed to fetch delivery updates',
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const verifyOtp = async (otpToVerify?: string) => {
    const otpValue = otpToVerify || otp;
    if (!otpValue) {
      toast({
        title: 'Error',
        description: 'Please enter OTP',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/deliveries/otp`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_API_KEY}`
        },
        body: JSON.stringify({ otp: otpValue }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Invalid OTP');
      }

      setIsVerified(true);
      await fetchDeliveryData();
      startAutoRefresh();
    } catch (error) {
      console.error('Error verifying OTP:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to verify OTP',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchDeliveryData();
  };

  if (!isVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">Verify Your Identity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Input
                  type="text"
                  placeholder="Enter OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="text-center text-lg font-mono tracking-widest"
                  maxLength={6}
                  disabled={isLoading}
                />
              </div>
              <Button
                onClick={() => verifyOtp()}
                disabled={isLoading || !otp}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify OTP'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Format ETA if available
  const formatEta = () => {
    if (!delivery?.eta) return 'Calculating...';
    const etaDate = new Date(delivery.eta);
    return etaDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Map - Takes full screen minus header and info panel */}
      <div className="flex-1 relative">
        <DeliveryMap 
          riderLocation={delivery?.driver?.liveLocation} 
          destination={destination}
          isLoading={isRefreshing} 
        />
        
        {/* Refresh button with loading state */}
        <div className="absolute top-4 right-4 z-10 flex items-center space-x-2">
          {isRefreshing && (
            <span className="text-xs text-gray-600 bg-white/90 px-2 py-1 rounded-full">
              Updating...
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="bg-white p-2 rounded-full shadow-md hover:bg-gray-100 transition-colors"
            aria-label="Refresh location"
          >
            <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Info Panel - Slides up from bottom */}
      <div className="bg-white border-t border-gray-200 p-4">
        <div className="space-y-4">
          {/* Delivery Status */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-medium text-gray-700">
                Delivery #{delivery?.id || '...'}
              </h2>
              <p className="text-sm text-gray-500">
                Status: <span className="font-medium capitalize">
                  {delivery?.status?.toLowerCase() || '...'}
                </span>
              </p>
            </div>
            <div className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
              Live Tracking
            </div>
          </div>

          {/* ETA and Distance */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-xs text-gray-500">Estimated Arrival</p>
                  <p className="font-medium">{formatEta()}</p>
                </div>
              </div>
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <div className="flex items-center space-x-2">
                <MapPin className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-xs text-gray-500">Distance</p>
                  <p className="font-medium">
                    {delivery?.distance ? `${delivery.distance.toFixed(1)} km` : 'Calculating...'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Driver Info */}
          <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
            <div className="bg-blue-100 p-2 rounded-full">
              <Truck className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-gray-900">
                {delivery?.driver?.name || 'Driver'}
              </h3>
              <p className="text-sm text-gray-700">
                {delivery?.driver?.vehicleNumber || 'En route to your location'}
              </p>
            </div>
            {delivery?.driver?.phone && (
              <a 
                href={`tel:${delivery.driver.phone}`}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Call
              </a>
            )}
          </div>

          {/* Delivery Details */}
          <div className="space-y-2">
            <div className="flex items-start space-x-3">
              <div className="bg-purple-100 p-2 rounded-full mt-1">
                <MapPin className="h-5 w-5 text-purple-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-gray-900">Delivery To</h3>
                <p className="text-sm text-gray-700">
                  {delivery?.order?.customer?.name || 'Your Location'}
                </p>
                {delivery?.order?.deliveryAddress && (
                  <p className="text-xs text-gray-500 mt-1">
                    {delivery.order.deliveryAddress}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
