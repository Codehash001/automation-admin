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
  const markers = useRef<{ [key: string]: mapboxgl.Marker }>({});
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [showRecenterButton, setShowRecenterButton] = useState(false);
  const isCentered = useRef(true);
  const currentZoom = useRef(14);
  const centerMarker = useRef<mapboxgl.Marker | null>(null);
  const userZoomed = useRef(false);
  const userInteracted = useRef(false);
  const lastLocationUpdate = useRef<number>(0);
  const animationFrameId = useRef<number>();
  const routeLayerId = useRef<string>('route');
  
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

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    // Create a new map instance with the container and options
    map.current = new mapboxgl.Map({
      ...mapOptions,
      container: mapContainer.current, // Set container here
    });

    // Add navigation controls (compass + zoom)
    map.current.addControl(new mapboxgl.NavigationControl({
      showCompass: true,
      showZoom: true,
      visualizePitch: true
    }), 'top-right');

    // Add fullscreen control
    map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right');

    // Handle map load
    map.current.once('load', () => {
      if (!map.current) return;
      
      setIsMapLoaded(true);
      
      // Add source and layer for route line
      map.current.addSource('route', {
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

      // Add route line layer
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
          'line-width': 5,
          'line-opacity': 0.8
        }
      });

      // Add pickup pin
      const pickupPin = document.createElement('div');
      pickupPin.className = 'w-8 h-8 bg-green-500 rounded-full border-2 border-white shadow-lg';
      
      new mapboxgl.Marker({
        element: pickupPin,
        anchor: 'bottom',
        offset: [0, 0]
      })
        .setLngLat(pickupLocation || [0, 0])
        .addTo(map.current);
    });

    // Cleanup on unmount
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [mapOptions]);

  // Function to update markers
  const updateMarkers = useCallback(() => {
    if (!map.current) return;
    
    // Update current location marker
    if (currentLocation) {
      updateMarker('current', currentLocation, 'current-location');
    }
    
    // Update pickup marker if needed
    if (pickupLocation && showPickupRoute) {
      updateMarker('pickup', pickupLocation, 'pickup-location');
    }
    
    // Update dropoff marker if needed
    if (dropoffLocation && showDropoffRoute) {
      updateMarker('dropoff', dropoffLocation, 'dropoff-location');
    }
  }, [currentLocation, pickupLocation, dropoffLocation, showPickupRoute, showDropoffRoute]);

  // Function to update routes
  const updateRoutes = useCallback(async () => {
    if (!map.current || !currentLocation) return;
    
    // Update pickup route if needed
    if (showPickupRoute && pickupLocation) {
      try {
        const response = await fetch(
          `https://api.mapbox.com/directions/v5/mapbox/driving/` +
          `${currentLocation.lng},${currentLocation.lat};${pickupLocation.lng},${pickupLocation.lat}` +
          `?geometries=geojson&access_token=${process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}`
        );
        
        const data = await response.json();
        
        if (data.routes && data.routes[0]) {
          const route = data.routes[0].geometry;
          
          // Update the route line with proper type assertion
          const source = map.current.getSource('route') as mapboxgl.GeoJSONSource;
          if (source) {
            source.setData({
              type: 'Feature',
              properties: {},
              geometry: route
            });
          }
        }
      } catch (error) {
        console.error('Error fetching route:', error);
      }
    }
  }, [currentLocation, pickupLocation, showPickupRoute]);

  // Update markers when locations change
  useEffect(() => {
    if (!map.current) return;
    updateMarkers();
  }, [currentLocation, pickupLocation, dropoffLocation, showPickupRoute, showDropoffRoute]);

  // Update route when it changes
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;
    
    // If we have a pre-calculated route, use it
    if (route?.length) {
      const sourceId = 'predefined-route';
      const layerId = 'predefined-route-layer';
      
      if (map.current.getSource(sourceId)) {
        (map.current.getSource(sourceId) as mapboxgl.GeoJSONSource).setData({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: route
          }
        });
      } else {
        map.current.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: route
            }
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
            'line-color': '#3b82f6',
            'line-width': 4,
            'line-opacity': 0.8
          }
        });
      }
    }
    
    // Always update dynamic routes based on current location
    updateRoutes();
  }, [route, isMapLoaded, updateRoutes]);

  // Update routes when locations change
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;
    updateRoutes();
  }, [currentLocation, pickupLocation, dropoffLocation, isMapLoaded, showPickupRoute, showDropoffRoute]);

  // Helper function to update a single marker
  const updateMarker = (id: string, location: MapLocation, className: string) => {
    if (!map.current) return;
    
    if (!markers.current[id]) {
      const el = document.createElement('div');
      el.className = `marker ${className}`;
      
      // Add different marker styles based on type
      if (id === 'current') {
        el.innerHTML = `
          <div class="relative w-6 h-6">
            <div class="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-75"></div>
            <div class="absolute inset-1 bg-blue-600 rounded-full"></div>
          </div>
        `;
      } else if (id === 'pickup') {
        el.innerHTML = `
          <div class="relative w-6 h-6">
            <div class="absolute inset-0 bg-green-500 rounded-full"></div>
            <div class="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-white text-green-700 text-xs font-bold px-2 py-1 rounded whitespace-nowrap">
              Pick Up
            </div>
          </div>
        `;
      } else if (id === 'dropoff') {
        el.innerHTML = `
          <div class="relative w-6 h-6">
            <div class="absolute inset-0 bg-red-500 rounded-full"></div>
            <div class="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-white text-red-700 text-xs font-bold px-2 py-1 rounded whitespace-nowrap">
              Drop Off
            </div>
          </div>
        `;
      }
      
      markers.current[id] = new mapboxgl.Marker(el)
        .setLngLat([location.lng, location.lat])
        .addTo(map.current);
    } else {
      markers.current[id].setLngLat([location.lng, location.lat]);
    }
  };
  
  // Helper function to update a single route
  const updateRoute = async (origin: [number, number], destination: [number, number], type: 'pickup' | 'dropoff') => {
    if (!map.current) return;
    
    const sourceId = `route-${type}`;
    const layerId = `${sourceId}-layer`;
    
    try {
      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/` +
        `${origin[0]},${origin[1]};${destination[0]},${destination[1]}` +
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

  // Update map when locations change (with throttling)
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;
    
    const now = Date.now();
    if (now - lastLocationUpdate.current < 1000) return;
    lastLocationUpdate.current = now;
    
    // Update camera position
    if (!userInteracted.current && currentLocation) {
      map.current?.easeTo({
        center: [currentLocation.lng, currentLocation.lat],
        duration: 1000,
        essential: true
      });
    }
  }, [currentLocation, pickupLocation, dropoffLocation, isMapLoaded]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      
      if (map.current) {
        // Remove all markers
        Object.values(markers.current).forEach(marker => marker.remove());
        
        // Remove route layer if it exists
        if (map.current.getLayer(routeLayerId.current)) {
          map.current.removeLayer(routeLayerId.current);
        }
        
        // Remove source
        if (map.current.getSource(routeLayerId.current)) {
          map.current.removeSource(routeLayerId.current);
        }
      }
    };
  }, []);

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
