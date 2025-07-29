'use client';

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Set your Mapbox access token here or in an environment variable
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '';

export interface MapLocation {
  lat: number;
  lng: number;
}

interface MapProps {
  currentLocation?: MapLocation | null;
  pickupLocation?: MapLocation | null;
  dropoffLocation?: MapLocation | null;
  route?: [number, number][];
  onRouteUpdate?: (route: { coordinates: Array<[number, number]>; distance: number; duration: number }) => void;
  showPickupRoute?: boolean;
  showDropoffRoute?: boolean;
  onDistanceUpdate?: (distance: number, duration: number, type: 'pickup' | 'dropoff') => void;
  isPickedUp?: boolean; // New prop to track pickup status
}

const Map: React.FC<MapProps> = ({
  currentLocation,
  pickupLocation,
  dropoffLocation,
  route = [],
  onRouteUpdate,
  showPickupRoute = true,
  showDropoffRoute = true,
  onDistanceUpdate,
  isPickedUp = false, // Default to false
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const currentMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const pickupMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const dropoffMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const routeSourceRef = useRef<mapboxgl.GeoJSONSource | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastLocationRef = useRef<MapLocation | null>(null);
  const lastUpdateTime = useRef<number>(0);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [isFollowing, setIsFollowing] = useState(true);
  const userInteracted = useRef(false);
  const lastRouteUpdate = useRef<number>(0);
  const ROUTE_UPDATE_INTERVAL = 10000; // 10 seconds between route updates

  // Calculate distance between two points in km
  const calculateDistance = (loc1: MapLocation, loc2: MapLocation): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (loc2.lat - loc1.lat) * Math.PI / 180;
    const dLon = (loc2.lng - loc1.lng) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(loc1.lat * Math.PI / 180) * Math.cos(loc2.lat * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };

  // Format distance for display
  const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  };

  // Format duration for display
  const formatDuration = (seconds: number): string => {
    const mins = Math.ceil(seconds / 60);
    if (mins < 60) {
      return `${mins} min`;
    }
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}m`;
  };

  // Update route between two points
  const updateRoute = useCallback(async (origin: MapLocation, destination: MapLocation) => {
    if (!map.current) return;

    try {
      const now = Date.now();
      if (now - lastRouteUpdate.current < ROUTE_UPDATE_INTERVAL) return;
      lastRouteUpdate.current = now;

      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/` +
        `${origin.lng},${origin.lat};${destination.lng},${destination.lat}` +
        `?geometries=geojson&overview=full&access_token=${process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}`
      );

      const data = await response.json();
      
      if (data.routes?.[0]) {
        const route = data.routes[0];
        const distance = route.distance; // in meters
        const duration = route.duration; // in seconds
        
        // Update route line
        if (routeSourceRef.current) {
          routeSourceRef.current.setData({
            type: 'Feature',
            properties: {},
            geometry: route.geometry
          });
        }
        
        // Update distance and duration
        setDistance(distance);
        setDuration(duration);
        
        // Notify parent component
        if (onDistanceUpdate) {
          onDistanceUpdate(distance, duration, isPickedUp ? 'dropoff' : 'pickup');
        }
      }
    } catch (error) {
      console.error('Error updating route:', error);
    }
  }, [isPickedUp, onDistanceUpdate]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: currentLocation ? [currentLocation.lng, currentLocation.lat] : [0, 0],
      zoom: 14,
      pitch: 45,
      bearing: 0,
      dragRotate: true,
      touchPitch: true,
      touchZoomRotate: true,
      pitchWithRotate: true,
      antialias: true,
      attributionControl: false,
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl({
      showCompass: true,
      showZoom: true,
      visualizePitch: true
    }), 'top-right');

    map.current.on('load', () => {
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
      });

      // Add current location marker
      if (currentLocation && map.current) {
        const el = document.createElement('div');
        el.className = 'w-5 h-5 bg-blue-500 rounded-full border-2 border-white shadow-lg';
        currentMarkerRef.current = new mapboxgl.Marker({
          element: el,
          anchor: 'center',
        }).setLngLat([currentLocation.lng, currentLocation.lat]).addTo(map.current);
      }

      // Add pickup marker with label
      if (pickupLocation && map.current) {
        // Create marker element
        const markerEl = document.createElement('div');
        markerEl.className = 'relative flex flex-col items-center';
        
        // Create the marker dot
        const dotEl = document.createElement('div');
        dotEl.className = 'w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-lg';
        
        // Create the label
        const labelEl = document.createElement('div');
        labelEl.className = 'absolute -bottom-7 bg-white text-xs font-medium px-2 py-1 rounded shadow-md whitespace-nowrap';
        labelEl.textContent = 'Pickup';
        
        // Append elements
        markerEl.appendChild(dotEl);
        markerEl.appendChild(labelEl);
        
        // Create and add the marker
        pickupMarkerRef.current = new mapboxgl.Marker({
          element: markerEl,
          anchor: 'bottom',
        }).setLngLat([pickupLocation.lng, pickupLocation.lat]).addTo(map.current);
      }

      // Add dropoff marker with label if available
      if (dropoffLocation && map.current) {
        // Create marker element
        const markerEl = document.createElement('div');
        markerEl.className = 'relative flex flex-col items-center';
        
        // Create the marker dot
        const dotEl = document.createElement('div');
        dotEl.className = 'w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-lg';
        
        // Create the label
        const labelEl = document.createElement('div');
        labelEl.className = 'absolute -bottom-7 bg-white text-xs font-medium px-2 py-1 rounded shadow-md whitespace-nowrap';
        labelEl.textContent = 'Drop-off';
        
        // Append elements
        markerEl.appendChild(dotEl);
        markerEl.appendChild(labelEl);
        
        // Create and add the marker
        dropoffMarkerRef.current = new mapboxgl.Marker({
          element: markerEl,
          anchor: 'bottom',
        }).setLngLat([dropoffLocation.lng, dropoffLocation.lat]).addTo(map.current);
      }
    });

    // Track user interaction
    const onUserInteraction = () => {
      if (!userInteracted.current) {
        userInteracted.current = true;
        setIsFollowing(false);
      }
    };

    map.current.on('dragstart', onUserInteraction);
    map.current.on('zoomstart', onUserInteraction);
    map.current.on('rotatestart', onUserInteraction);
    map.current.on('pitchend', onUserInteraction);

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Update markers and route when locations change
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;

    // Update current location marker
    if (currentLocation) {
      if (currentMarkerRef.current) {
        currentMarkerRef.current.setLngLat([currentLocation.lng, currentLocation.lat]);
      }

      // Update map center to follow location if in following mode
      if (isFollowing && map.current && !map.current.isMoving()) {
        map.current.flyTo({
          center: [currentLocation.lng, currentLocation.lat],
          essential: true,
          duration: 1000,
          zoom: 14
        });
      }

      // Update route if needed
      const targetLocation = isPickedUp ? dropoffLocation : pickupLocation;
      if (targetLocation) {
        updateRoute(currentLocation, targetLocation);
      }
    }
  }, [currentLocation, isMapLoaded, isFollowing, isPickedUp, pickupLocation, dropoffLocation, updateRoute]);

  // Toggle follow mode
  const handleRecenter = useCallback(() => {
    if (!map.current || !currentLocation) return;
    
    setIsFollowing(true);
    userInteracted.current = false;
    
    map.current.flyTo({
      center: [currentLocation.lng, currentLocation.lat],
      zoom: 14,
      duration: 1000,
      essential: true
    });
  }, [currentLocation]);

  return (
    <div className="relative w-full h-full">
      {/* Map container */}
      <div 
        ref={mapContainer} 
        className="w-full h-full"
      />
      
      {/* Recenter button */}
      {!isFollowing && (
        <button
          onClick={handleRecenter}
          className="absolute flex items-center gap-2 bottom-4 right-4 bg-white dark:bg-gray-800 p-2 rounded-full shadow-lg z-10 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="Recenter map"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-700 dark:text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-xs font-medium">Re-center</span>
        </button>
      )}
    </div>
  );
};

export default Map;
