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
}

const Map: React.FC<MapProps> = ({
  currentLocation,
  pickupLocation,
  dropoffLocation,
  route = [],
  onRouteUpdate,
  showPickupRoute = true,
  showDropoffRoute = true,
  onDistanceUpdate
}: MapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const currentMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const pickupMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const routeSourceRef = useRef<mapboxgl.GeoJSONSource | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastLocationRef = useRef<MapLocation | null>(null);
  const lastUpdateTime = useRef<number>(0);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [showRecenterButton, setShowRecenterButton] = useState(false);
  const isCentered = useRef(true);
  const currentZoom = useRef(14);
  const centerMarker = useRef<mapboxgl.Marker | null>(null);
  const userZoomed = useRef(false);
  const userInteracted = useRef(false);
  const lastLocationUpdate = useRef<number>(0);
  
  // Minimum distance (in kilometers) to trigger a route update
  const MIN_DISTANCE_UPDATE_KM = 0.05; // 50 meters
  
  // Function to calculate distance between two points in kilometers
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

  // Memoize map options to prevent unnecessary re-renders
  const mapOptions = useMemo(() => ({
    style: 'mapbox://styles/mapbox/streets-v11',
    center: (currentLocation 
      ? [currentLocation.lng, currentLocation.lat] 
      : [55.2708, 25.2048]) as [number, number],
    zoom: 14,
    pitch: 45,  // Enable 3D tilt
    bearing: 0,  // Initial rotation
    minZoom: 1,
    maxZoom: 18,
    dragRotate: true,  // Enable rotation with two fingers
    touchPitch: true,  // Enable pitch with two fingers
    touchZoomRotate: true,  // Enable all touch gestures
    pitchWithRotate: true,  // Allow pitch changes during rotation
    renderWorldCopies: false,
    antialias: true,  // Better rendering
    attributionControl: false,  // We'll add our own
    customAttribution: ' Mapbox',
    maxPitch: 60,  // Maximum tilt angle
    minPitch: 0,   // Minimum tilt angle
  }), [currentLocation]);

  // Initialize map with controls
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    map.current = new mapboxgl.Map({
      ...mapOptions,
      container: mapContainer.current,
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl({
      showCompass: true,
      showZoom: true,
      visualizePitch: true
    }), 'top-right');

    map.current.on('load', () => {
      setIsMapLoaded(true);
      
      // Create and store the route source
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
          'line-width': 5,
          'line-opacity': 0.8
        }
      });

      // Initialize current location marker
      if (currentLocation && map.current) {
        const el = document.createElement('div');
        el.className = 'w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg';
        currentMarkerRef.current = new mapboxgl.Marker({
          element: el,
          anchor: 'center',
        }).setLngLat([currentLocation.lng, currentLocation.lat]).addTo(map.current);
      }

      // Initialize pickup marker
      if (pickupLocation && map.current) {
        const el = document.createElement('div');
        el.className = 'w-6 h-6 bg-green-500 rounded-full border-2 border-white shadow-lg';
        pickupMarkerRef.current = new mapboxgl.Marker({
          element: el,
          anchor: 'bottom',
        }).setLngLat([pickupLocation.lng, pickupLocation.lat]).addTo(map.current);
      }
    });

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

  // Update markers when locations change
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;

    // Only update if location has changed significantly
    if (currentLocation && 
        (!lastLocationRef.current || 
         calculateDistance(currentLocation, lastLocationRef.current) > MIN_DISTANCE_UPDATE_KM)) {
      
      lastLocationRef.current = {...currentLocation};
      
      // Use requestAnimationFrame for smoother updates
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      animationFrameRef.current = requestAnimationFrame(() => {
        // Update current location marker
        if (currentMarkerRef.current) {
          currentMarkerRef.current.setLngLat([currentLocation.lng, currentLocation.lat]);
        }
        
        // Update map center to follow location (if not manually moved)
        if (map.current && !map.current.isMoving()) {
          map.current.flyTo({
            center: [currentLocation.lng, currentLocation.lat],
            essential: true,
            zoom: 14
          });
        }
      });
    }
    
    // Update pickup marker if needed
    if (pickupLocation && pickupMarkerRef.current) {
      pickupMarkerRef.current.setLngLat([pickupLocation.lng, pickupLocation.lat]);
    }
    
  }, [currentLocation, pickupLocation, isMapLoaded]);

  // Update route when locations change
  useEffect(() => {
    if (!map.current || !isMapLoaded || !currentLocation || !pickupLocation) return;
    
    const now = Date.now();
    // Throttle route updates to once per 5 seconds
    if (now - lastUpdateTime.current < 5000) return;
    
    lastUpdateTime.current = now;
    
    // Update pickup route if needed
    if (showPickupRoute) {
      updateRoute(currentLocation, pickupLocation, 'pickup');
    }
    
    // Update dropoff route if needed
    if (showDropoffRoute && dropoffLocation) {
      updateRoute(pickupLocation, dropoffLocation, 'dropoff');
    }
  }, [currentLocation, pickupLocation, dropoffLocation, isMapLoaded, showPickupRoute, showDropoffRoute]);

  // Helper function to update a single route
  const updateRoute = async (origin: MapLocation, destination: MapLocation, type: 'pickup' | 'dropoff') => {
    if (!map.current) return;
    
    const sourceId = `route-${type}`;
    const layerId = `${sourceId}-layer`;
    
    try {
      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/` +
        `${origin.lng},${origin.lat};${destination.lng},${destination.lat}` +
        `?geometries=geojson&access_token=${mapboxgl.accessToken}`
      );
      
      const data = await response.json();
      
      if (!data.routes || data.routes.length === 0) {
        throw new Error('No route found');
      }
      
      const route = data.routes[0];
      
      if (map.current.getSource(sourceId)) {
        (map.current.getSource(sourceId) as mapboxgl.GeoJSONSource).setData({
          type: 'Feature',
          properties: {},
          geometry: route.geometry
        });
      } else {
        map.current.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: route.geometry
          }
        });
        
        map.current.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': type === 'pickup' ? '#3b82f6' : '#10b981',
            'line-width': 4,
            'line-opacity': 0.8
          }
        });
      }
      
      if (onDistanceUpdate) {
        onDistanceUpdate(
          route.distance / 1000, // Convert to km
          route.duration / 60,   // Convert to minutes
          type
        );
      }
      
    } catch (error) {
      console.error(`Error updating ${type} route:`, error);
      if (map.current.getLayer(layerId)) map.current.removeLayer(layerId);
      if (map.current.getSource(sourceId)) map.current.removeSource(sourceId);
    }
  };

  return (
    <div 
      ref={mapContainer} 
      className="w-full h-full"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden'
      }}
    />
  );
};

export default Map;
