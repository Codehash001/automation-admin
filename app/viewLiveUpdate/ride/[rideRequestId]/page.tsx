'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, MapPin, Clock } from 'lucide-react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { toast } from '@/hooks/use-toast';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '';

// Reuse the same rider dot styling as delivery page
const parseCoords = (coords: string | null | undefined): { lat: number; lng: number } | null => {
  if (!coords) return null;
  const [lat, lng] = coords.split(',').map(Number);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  return null;
};

const parseRiderLocation = (location: string): [number, number] | null => {
  const [lat, lng] = location.split(',').map(Number);
  return !isNaN(lat) && !isNaN(lng) ? [lng, lat] : null;
};

function RideMap({ riderLocation, destination, isLoading }: { riderLocation: string | null, destination: { lat: number; lng: number } | null, isLoading: boolean }) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const riderMarker = useRef<mapboxgl.Marker | null>(null);
  const destinationMarker = useRef<mapboxgl.Marker | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: number; duration: number } | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const userInteracted = useRef(false);
  const isFollowing = useRef(true);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const lastRouteUpdate = useRef<number>(0);
  const ROUTE_UPDATE_INTERVAL = 10000;
  const updateInterval = useRef<NodeJS.Timeout | null>(null);
  const initialLoad = useRef(true);

  const updateDirectLine = useCallback((from: [number, number], to: [number, number], duration?: number) => {
    if (!map.current) return;
    if (!map.current.getSource('route-line')) {
      map.current.addSource('route-line', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: [from, to] },
        },
      });
      map.current.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route-line',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#3b82f6', 'line-width': 3, 'line-dasharray': [2, 2] },
      });
    } else {
      (map.current.getSource('route-line') as mapboxgl.GeoJSONSource).setData({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: [from, to] },
      });
    }
  }, []);

  useEffect(() => {
    return () => {
      if (map.current) {
        if (map.current.getLayer('route-line')) map.current.removeLayer('route-line');
        if (map.current.getSource('route-line')) map.current.removeSource('route-line');
      }
    };
  }, []);

  const updateRoute = useCallback(async (start: [number, number], end: [number, number]) => {
    if (!map.current || !isMapLoaded) return;
    updateDirectLine(start, end);
    try {
      const coords = `${start[0]},${start[1]};${end[0]},${end[1]}`;
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?geometries=geojson&overview=full&steps=false&access_token=${mapboxgl.accessToken}`;
      const res = await fetch(url);
      const data = await res.json();
      const route = data?.routes?.[0];
      if (route?.geometry) {
        if (!map.current.getSource('route')) {
          map.current.addSource('route', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: route.geometry } });
          map.current.addLayer({ id: 'route', type: 'line', source: 'route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#3b82f6', 'line-width': 4, 'line-opacity': 0.8 } }, 'waterway-label');
        } else {
          (map.current.getSource('route') as mapboxgl.GeoJSONSource).setData({ type: 'Feature', properties: {}, geometry: route.geometry });
        }
        setRouteInfo({ distance: route.distance, duration: Math.round(route.duration / 60) });
        setLastUpdate(new Date());
      }
    } catch {
      // ignore, we still show direct line
    }
    updateDirectLine(start, end);
  }, [isMapLoaded, updateDirectLine]);

  useEffect(() => {
    if (map.current || !mapContainer.current) return;
    let center: [number, number] = [0, 20];
    let zoom = 2;
    if (destination) {
      center = [destination.lng, destination.lat];
      zoom = 15;
    }
    if (riderLocation) {
      const rc = parseRiderLocation(riderLocation);
      if (rc) { center = rc; zoom = 15; }
    }
    map.current = new mapboxgl.Map({ container: mapContainer.current, style: 'mapbox://styles/mapbox/streets-v11', center, zoom, maxZoom: 18, minZoom: 2, pitch: 45, bearing: 0, interactive: true, trackResize: true, antialias: true });
    map.current.addControl(new mapboxgl.NavigationControl());
    map.current.on('load', () => { setIsMapLoaded(true); initialLoad.current = false; });
    const onInteract = () => { userInteracted.current = true; isFollowing.current = false; };
    map.current.on('mousedown', onInteract);
    map.current.on('touchstart', onInteract);
    map.current.on('move', onInteract);
    return () => { if (map.current) { map.current.off('mousedown', onInteract); map.current.off('touchstart', onInteract); map.current.off('move', onInteract); map.current.remove(); map.current = null; } };
  }, [destination, riderLocation]);

  const hasCenteredOnDestination = useRef(false);

  useEffect(() => {
    if (!map.current || !riderLocation || !destination || !isMapLoaded || initialLoad.current) return;
    const rc = parseRiderLocation(riderLocation);
    if (!rc) return;
    const [lng, lat] = rc;
    if (!riderMarker.current) {
      const el = document.createElement('div');
      el.className = 'rider-dot';
      riderMarker.current = new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat([lng, lat]).addTo(map.current);
    } else {
      riderMarker.current.setLngLat([lng, lat]);
    }
    if (!destinationMarker.current) {
      const el = document.createElement('div');
      el.className = 'w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-lg';
      const label = document.createElement('div');
      label.className = 'absolute -bottom-7 bg-white text-xs font-medium px-2 py-1 rounded shadow-md whitespace-nowrap';
      label.textContent = 'Destination';
      const container = document.createElement('div');
      container.className = 'relative flex flex-col items-center';
      container.appendChild(el); container.appendChild(label);
      destinationMarker.current = new mapboxgl.Marker({ element: container, anchor: 'bottom' }).setLngLat([destination.lng, destination.lat]).addTo(map.current);
    } else {
      destinationMarker.current.setLngLat([destination.lng, destination.lat]);
    }
    if (!hasCenteredOnDestination.current && map.current) {
      hasCenteredOnDestination.current = true;
      map.current.flyTo({ center: [destination.lng, destination.lat], zoom: 15, essential: true });
    }
    updateRoute([lng, lat], [destination.lng, destination.lat]);
    if (!userInteracted.current && map.current) {
      const b = new mapboxgl.LngLatBounds();
      b.extend([lng, lat]); b.extend([destination.lng, destination.lat]);
      map.current.fitBounds(b, { padding: { top: 100, bottom: 100, left: 100, right: 100 }, maxZoom: 15, essential: true });
    }
  }, [riderLocation, destination, isMapLoaded, updateRoute]);

  useEffect(() => {
    if (updateInterval.current) clearInterval(updateInterval.current);
    updateInterval.current = null;
    if (riderLocation && destination) {
      const tick = () => {
        const now = Date.now();
        if (now - lastRouteUpdate.current >= ROUTE_UPDATE_INTERVAL) {
          const rc = parseRiderLocation(riderLocation);
          if (rc) updateRoute(rc, [destination.lng, destination.lat]);
        }
      };
      tick();
      updateInterval.current = setInterval(tick, ROUTE_UPDATE_INTERVAL);
    }
    return () => { if (updateInterval.current) { clearInterval(updateInterval.current); updateInterval.current = null; } };
  }, [riderLocation, destination, updateRoute]);

  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      .rider-dot { width: 16px; height: 16px; background-color: #3b82f6; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.5); }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  return (
    <div className="relative w-full h-screen flex flex-col">
      <div ref={mapContainer} className="flex-1 w-full" />
      {routeInfo && (
        <div className="absolute bottom-4 left-2 right-2 md:left-4 md:right-auto bg-white p-2 md:p-3 rounded-lg shadow-md z-10 max-w-md mx-auto md:mx-0">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <span className="text-sm font-medium">{(routeInfo.distance / 1000).toFixed(1)}km</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <span className="text-sm font-medium">ETA: {routeInfo.duration} min</span>
            </div>
          </div>
          {lastUpdate && (
            <div className="text-xs text-gray-500 mt-1 text-center sm:text-left">Updated: {new Date(lastUpdate).toLocaleTimeString()}</div>
          )}
        </div>
      )}
      {!isFollowing.current && (
        <button
          onClick={() => {
            if (riderLocation && map.current) {
              const rc = parseRiderLocation(riderLocation);
              if (rc) { map.current.flyTo({ center: rc, zoom: 15, essential: true }); isFollowing.current = true; }
            }
          }}
          className="absolute bottom-16 md:bottom-4 right-2 md:right-4 bg-white dark:bg-gray-800 p-2 rounded-full shadow-lg z-10 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="Recenter map"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-6 md:w-6 text-gray-700 dark:text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default function RideLiveViewPage({ params }: { params: { rideRequestId: string } }) {
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [ride, setRide] = useState<any>(null);
  const [isVerified, setIsVerified] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const refreshInterval = useRef<NodeJS.Timeout | null>(null);

  // destination: prefer dropoff, else pickup
  const destination = useMemo(() => {
    const d1 = parseCoords(ride?.dropoffLocation);
    if (d1) return d1;
    const d2 = parseCoords(ride?.pickupLocation);
    return d2 || null;
  }, [ride]);

  const startAutoRefresh = useCallback(() => {
    if (refreshInterval.current) clearInterval(refreshInterval.current);
    refreshInterval.current = setInterval(fetchRideData, 10000);
  }, []);

  useEffect(() => {
    return () => { if (refreshInterval.current) clearInterval(refreshInterval.current); };
  }, []);

  // URL otp support
  useEffect(() => {
    const otpParam = searchParams.get('otp');
    if (otpParam) {
      setOtp(otpParam);
      verifyOtp(otpParam);
    }
  }, [searchParams]);

  const fetchRideData = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const response = await fetch(`/api/driver-service?id=${params.rideRequestId}`, {
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_API_KEY || ''}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      if (!response.ok) throw new Error('Failed to fetch ride data');
      const data = await response.json();
      setRide((prev: any) => ({
        ...prev,
        ...data,
        driver: data.driver ? { ...prev?.driver, ...data.driver } : prev?.driver,
      }));
    } catch (error) {
      if (!isVerified) return;
      toast({ title: 'Error', description: 'Failed to fetch ride updates', variant: 'destructive' });
    } finally {
      setIsRefreshing(false);
    }
  };

  const verifyOtp = async (otpToVerify?: string) => {
    const otpValue = otpToVerify || otp;
    if (!otpValue) {
      toast({ title: 'Error', description: 'Please enter OTP', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    try {
      // Use the same OTP endpoint as delivery
      const response = await fetch(`/api/deliveries/otp`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_API_KEY || ''}` },
        body: JSON.stringify({ otp: otpValue }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Invalid OTP');
      setIsVerified(true);
      await fetchRideData();
      startAutoRefresh();
    } catch (error: any) {
      toast({ title: 'Error', description: error?.message || 'Failed to verify OTP', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => { fetchRideData(); };

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
                <Input type="text" placeholder="Enter OTP" value={otp} onChange={(e) => setOtp(e.target.value)} className="text-center text-lg font-mono tracking-widest" maxLength={6} disabled={isLoading} />
              </div>
              <Button onClick={() => verifyOtp()} disabled={isLoading || !otp} className="w-full">
                {isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...</>) : ('Verify OTP')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      <div className="flex-1 relative">
        <RideMap riderLocation={ride?.driver?.liveLocation || null} destination={destination} isLoading={isRefreshing} />
      </div>
    </div>
  );
}
