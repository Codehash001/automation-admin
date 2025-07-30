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

// Utility function to ensure coordinates are in [lng, lat] format for Mapbox
const toMapboxCoords = (coords: [number, number] | { lat: number; lng: number }): [number, number] => {
  if (Array.isArray(coords)) {
    // If it's already an array, ensure it's in [lng, lat] order
    return [coords[1], coords[0]];
  }
  // If it's an object with lat/lng, convert to [lng, lat]
  return [coords.lng, coords.lat];
};

// Utility to parse rider location string to [lng, lat]
const parseRiderLocation = (location: string): [number, number] | null => {
  const [lat, lng] = location.split(',').map(Number);
  return !isNaN(lat) && !isNaN(lng) ? [lng, lat] : null;
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
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const userInteracted = useRef(false);
  const isFollowing = useRef(true);
  const routeSourceRef = useRef<mapboxgl.GeoJSONSource | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const lastRouteUpdate = useRef<number>(0);
  const ROUTE_UPDATE_INTERVAL = 10000; // 10 seconds between route updates
  const updateInterval = useRef<NodeJS.Timeout | null>(null);
  const initialLoad = useRef(true);

  // Create car marker
  const carMarker = useMemo(() => createCarIcon(), []);

  // Format distance for display
  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  };

  // Format duration for display
  const formatDuration = (seconds: number) => {
    const mins = Math.ceil(seconds / 60);
    if (mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins > 0 ? `${remainingMins}m` : ''}`.trim();
  };

  // Add a ref for the route line
  const routeLine = useRef<mapboxgl.Layer | null>(null);
  const routeSource = useRef<mapboxgl.GeoJSONSource | null>(null);
  const routeLabel = useRef<mapboxgl.Marker | null>(null);

  // Function to update the direct line between rider and destination
  const updateDirectLine = useCallback((from: [number, number], to: [number, number], duration?: number) => {
    if (!map.current) return;

    // Create or update the line source
    if (!routeSource.current) {
      map.current.addSource('route-line', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [from, to]
          }
        }
      });
      routeSource.current = map.current.getSource('route-line') as mapboxgl.GeoJSONSource;
      
      // Add the line layer
      map.current.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route-line',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#3b82f6',
          'line-width': 3,
          'line-dasharray': [2, 2]
        }
      });
    }

    // Update the line
    if (routeSource.current) {
      routeSource.current.setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: [from, to]
        }
      });
    }

    // Create or update the ETA label with actual duration
    const etaText = duration ? `${formatDuration(duration)} away` : 'Calculating...';
    
    if (!routeLabel.current) {
      const el = document.createElement('div');
      el.className = 'bg-white text-blue-600 text-xs font-bold px-2 py-1 rounded shadow-md whitespace-nowrap';
      el.textContent = etaText;
      
      routeLabel.current = new mapboxgl.Marker({
        element: el,
        offset: [0, 0]
      }).setLngLat([(from[0] + to[0]) / 2, (from[1] + to[1]) / 2]).addTo(map.current);
    } else {
      // Update existing label
      const el = routeLabel.current.getElement();
      if (el) {
        el.textContent = etaText;
      }
      routeLabel.current.setLngLat([(from[0] + to[0]) / 2, (from[1] + to[1]) / 2]);
    }
  }, []);

  // Clean up line and label on unmount
  useEffect(() => {
    return () => {
      if (map.current) {
        if (map.current.getLayer('route-line')) {
          map.current.removeLayer('route-line');
        }
        if (map.current.getSource('route-line')) {
          map.current.removeSource('route-line');
        }
      }
      if (routeLabel.current) {
        routeLabel.current.remove();
      }
    };
  }, []);

  // Update route between two points
  const updateRoute = useCallback(async (start: [number, number], end: [number, number]) => {
    if (!map.current || !isMapLoaded) {
      console.error('Map not loaded yet');
      return;
    }

    // Update the direct line immediately with current positions
    updateDirectLine(start, end, routeInfo?.duration);

    try {
      // Convert to Mapbox coordinates
      const mapboxStart = toMapboxCoords(start);
      const mapboxEnd = toMapboxCoords(end);
      
      // Check if points are too far apart for routing (e.g., different countries)
      const directDistance = Math.sqrt(
        Math.pow(mapboxEnd[0] - mapboxStart[0], 2) + 
        Math.pow(mapboxEnd[1] - mapboxStart[1], 2)
      ) * 100; // Rough distance in km

      console.log('Direct distance (km):', directDistance);

      let routeData: GeoJSON.Feature<GeoJSON.LineString>;

      if (directDistance > 100) { // If points are more than 100km apart
        console.log('Points too far apart for routing, showing direct line');
        
        // Create a simple direct line between points
        routeData = {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [mapboxStart, mapboxEnd]
          }
        };
        
        // Set a default duration/distance since we can't calculate it
        setRouteInfo({
          distance: directDistance * 1000, // Convert to meters
          duration: directDistance * 2 * 60 // Estimate 2 minutes per km
        });
      } else {
        try {
          // Format coordinates for URL: lng,lat;lng,lat
          const coordinates = `${mapboxStart[0]},${mapboxStart[1]};${mapboxEnd[0]},${mapboxEnd[1]}`;
          
          console.log('Making Mapbox Directions API request with coordinates:', coordinates);
          
          // Make API request with required parameters
          const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?geometries=geojson&overview=full&steps=true&access_token=${mapboxgl.accessToken}`;
          console.log('API URL:', url);
          
          const response = await fetch(url);
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error('Mapbox API error:', {
              status: response.status,
              statusText: response.statusText,
              error: errorText
            });
            throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
          }

          const data = await response.json();
          console.log('Route API response:', data);
          
          if (!data.routes?.[0]) {
            console.error('No route found in response:', data);
            throw new Error('No route found in response');
          }

          const route = data.routes[0];
          const distance = route.distance; // in meters
          const duration = route.duration; // in seconds
          
          console.log('Successfully got route:', { 
            distance: `${(distance/1000).toFixed(2)} km`, 
            duration: `${Math.round(duration/60)} min`,
            geometry: route.geometry ? 'present' : 'missing',
            coordinates: route.geometry?.coordinates?.length || 0
          });
          
          // Update route info with raw values (conversion happens in display)
          setRouteInfo({
            distance,
            duration
          });
          
          routeData = {
            type: 'Feature',
            properties: {},
            geometry: route.geometry
          };
        } catch (error) {
          console.error('Error fetching directions:', error);
          // Fall back to direct line if API call fails
          routeData = {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: [mapboxStart, mapboxEnd]
            }
          };
          setRouteInfo({
            distance: directDistance * 1000,
            duration: directDistance * 2 * 60
          });
        }
      }

      // Update the route source if it exists, otherwise create it
      if (!map.current.getSource('route')) {
        console.log('Creating new route source and layer');
        // Add the route source
        map.current.addSource('route', {
          type: 'geojson',
          data: routeData
        });

        // Add the route layer if it doesn't exist
        if (!map.current.getLayer('route')) {
          console.log('Adding route layer to map');
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
              'line-opacity': 0.8
            }
          }, 'waterway-label');
        }
      } else {
        console.log('Updating existing route source');
        // Update existing source
        (map.current.getSource('route') as mapboxgl.GeoJSONSource).setData(routeData);
      }
      
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error in updateRoute:', error);
    }
    
    // Update the direct line
    updateDirectLine(start, end, routeInfo?.duration);
  }, [updateDirectLine, isMapLoaded]);

  // Initialize map and add route source/layer
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    // Set default center based on destination or rider location if available
    let initialCenter: [number, number] = [0, 20]; // Default center
    let initialZoom = 2;

    // If we have a destination, use it as initial center
    if (destination) {
      initialCenter = [destination.lng, destination.lat];
      initialZoom = 15; // Zoom in more when we have a destination
    }
    // If we have a rider location, use it as initial center (will override destination if both exist)
    if (riderLocation) {
      const riderCoords = parseRiderLocation(riderLocation);
      if (riderCoords) {
        initialCenter = riderCoords;
        initialZoom = 15;
      }
    }

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: initialCenter,
      zoom: initialZoom,
      maxZoom: 18,
      minZoom: 2,
      pitch: 45,
      bearing: 0,
      interactive: true,
      trackResize: true,
      antialias: true
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl());

    // Handle map load
    map.current.on('load', () => {
      console.log('Map loaded, initial center:', initialCenter);
      setIsMapLoaded(true);
      
      // Add route source
      map.current?.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: []
          }
        }
      });
      
      // Store reference to the route source
      routeSourceRef.current = map.current?.getSource('route') as mapboxgl.GeoJSONSource;

      // Add route layer
      map.current?.addLayer({
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
          'line-opacity': 0.8
        }
      }, 'waterway-label');

      // Mark initial load as complete
      initialLoad.current = false;
    });

    // Track user interaction
    const handleInteraction = () => {
      userInteracted.current = true;
      isFollowing.current = false;
    };
    
    map.current.on('mousedown', handleInteraction);
    map.current.on('touchstart', handleInteraction);
    map.current.on('move', handleInteraction);

    // Cleanup function
    return () => {
      if (map.current) {
        map.current.off('mousedown', handleInteraction);
        map.current.off('touchstart', handleInteraction);
        map.current.off('move', handleInteraction);
        map.current.remove();
        map.current = null;
      }
    };
  }, []); // Empty dependency array ensures this only runs once on mount

  // Track if we've centered on destination
  const hasCenteredOnDestination = useRef(false);

  // Update rider marker and route when locations change
  useEffect(() => {
    if (!map.current || !riderLocation || !destination || !isMapLoaded || initialLoad.current) {
      console.log('Map not ready or missing locations:', { 
        map: !!map.current, 
        isMapLoaded, 
        riderLocation, 
        destination 
      });
      return;
    }

    try {
      // Parse rider location using our utility function
      const riderCoords = parseRiderLocation(riderLocation);
      if (!riderCoords) {
        console.error('Invalid rider location:', riderLocation);
        return;
      }
      const [riderLng, riderLat] = riderCoords;

      console.log('Updating rider position:', { riderLat, riderLng, destination });

      // Create or update rider marker with a blue dot
      const createRiderMarker = () => {
        const el = document.createElement('div');
        el.className = 'rider-dot';
        return el;
      };

      if (!riderMarker.current) {
        const markerEl = createRiderMarker();
        console.log('Creating new rider marker at:', [riderLng, riderLat]);
        riderMarker.current = new mapboxgl.Marker({
          element: markerEl,
          anchor: 'center'
        }).setLngLat([riderLng, riderLat]).addTo(map.current);  
      } else {
        console.log('Updating rider marker position to:', [riderLng, riderLat]);
        riderMarker.current.setLngLat([riderLng, riderLat]);
      }

      // Create or update destination marker
      if (!destinationMarker.current) {
        const el = document.createElement('div');
        el.className = 'w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-lg';
        
        const labelEl = document.createElement('div');
        labelEl.className = 'absolute -bottom-7 bg-white text-xs font-medium px-2 py-1 rounded shadow-md whitespace-nowrap';
        labelEl.textContent = 'Drop-off';
        
        const container = document.createElement('div');
        container.className = 'relative flex flex-col items-center';
        container.appendChild(el);
        container.appendChild(labelEl);

        destinationMarker.current = new mapboxgl.Marker({
          element: container,
          anchor: 'bottom'
        }).setLngLat(toMapboxCoords(destination)).addTo(map.current);
      } else if (destinationMarker.current) {
        destinationMarker.current.setLngLat(toMapboxCoords(destination));
      }

      // Center map on destination when first loaded
      if (!hasCenteredOnDestination.current && map.current) {
        hasCenteredOnDestination.current = true;
        map.current.flyTo({
          center: toMapboxCoords(destination),
          zoom: 15,
          essential: true
        });
      }

      // Update route using the utility function for consistent coordinate order
      updateRoute([riderLng, riderLat], [destination.lng, destination.lat]);

      // If user hasn't interacted, keep both points in view
      if (!userInteracted.current && map.current) {
        const bounds = new mapboxgl.LngLatBounds();
        bounds.extend([riderLng, riderLat]);
        bounds.extend(toMapboxCoords(destination));
        
        // Get current bounds and check if they exist
        const currentBounds = map.current.getBounds();
        if (currentBounds) {
          // Check if any corner of the desired bounds is outside current view
          const ne = bounds.getNorthEast();
          const sw = bounds.getSouthWest();
          const currentNe = currentBounds.getNorthEast();
          const currentSw = currentBounds.getSouthWest();
          
          const isOutside = 
            ne.lng > currentNe.lng || 
            ne.lat > currentNe.lat ||
            sw.lng < currentSw.lng || 
            sw.lat < currentSw.lat;
          
          if (isOutside) {
            map.current.fitBounds(bounds, {
              padding: { top: 100, bottom: 100, left: 100, right: 100 },
              maxZoom: 15,
              essential: true
            });
          }
        }
      }
    } catch (error) {
      console.error('Error updating markers:', error);
    }
  }, [riderLocation, destination, updateRoute, isMapLoaded]);

  // Add auto-refresh effect
  useEffect(() => {
    // Clear any existing interval
    if (updateInterval.current) clearInterval(updateInterval.current);
    updateInterval.current = null;

    // Only set up auto-refresh if we have both locations
    if (riderLocation && destination) {
      const updateRouteIfNeeded = () => {
        const now = Date.now();
        if (now - lastRouteUpdate.current >= ROUTE_UPDATE_INTERVAL) {
          const riderCoords = parseRiderLocation(riderLocation);
          if (riderCoords) {
            updateRoute(riderCoords, [destination.lng, destination.lat]);
          }
        }
      };

      // Initial update
      updateRouteIfNeeded();
      
      // Set up interval for subsequent updates
      updateInterval.current = setInterval(updateRouteIfNeeded, ROUTE_UPDATE_INTERVAL);
    }

    // Cleanup function
    return () => {
      if (updateInterval.current) {
        clearInterval(updateInterval.current);
        updateInterval.current = null;
      }
    };
  }, [riderLocation, destination, updateRoute]);

  useEffect(() => {
    // Add the pulsing animation styles
    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes pulse {
        0% { transform: scale(0.8); opacity: 0.8; }
        70% { transform: scale(1.2); opacity: 0.6; }
        100% { transform: scale(0.8); opacity: 0.8; }
      }
      
      .rider-dot {
        width: 16px;
        height: 16px;
        background-color: #3b82f6;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.5);
      }
      
      .status-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 500;
        text-transform: capitalize;
      }
      
      .status-pending { background-color: #fef3c7; color: #92400e; }
      .status-accepted { background-color: #dbeafe; color: #1e40af; }
      .status-picked_up { background-color: #dbeafe; color: #1e40af; }
      .status-delivered { background-color: #dcfce7; color: #166534; }
      .status-cancelled { background-color: #fee2e2; color: #991b1b; }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <div className="relative w-full h-screen flex flex-col">
      <div ref={mapContainer} className="flex-1 w-full" />

      {/* Route info overlay - made more compact for mobile */}
      {routeInfo && (
        <div className="absolute bottom-4 left-2 right-2 md:left-4 md:right-auto bg-white p-2 md:p-3 rounded-lg shadow-md z-10 max-w-md mx-auto md:mx-0">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <span className="text-sm font-medium truncate">
                {formatDistance(routeInfo.distance)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <span className="text-sm font-medium">
                ETA: {formatDuration(routeInfo.duration)}
              </span>
            </div>
          </div>
          {lastUpdate && (
            <div className="text-xs text-gray-500 mt-1 text-center sm:text-left">
              Updated: {new Date(lastUpdate).toLocaleTimeString()}
            </div>
          )}
        </div>
      )}

      {/* Recenter button - adjusted for mobile */}
      {!isFollowing.current && (
        <button
          onClick={() => {
            if (riderLocation && map.current) {
              const riderCoords = parseRiderLocation(riderLocation);
              if (riderCoords) {
                map.current.flyTo({
                  center: riderCoords,
                  zoom: 15,
                  essential: true
                });
                isFollowing.current = true;
              }
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
    if (!delivery?.order?.deliveryLocation) return null;
    try {
      const [lat, lng] = delivery.order.deliveryLocation.split(',').map(Number);
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
      console.log('Fetched delivery data:', data);
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
    </div>
  );
}
