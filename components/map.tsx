'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Set your Mapbox access token here or in an environment variable
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '';

interface MapProps {
  currentLocation: { lat: number; lng: number } | null;
  pickupLocation: { lat: number; lng: number; address?: string } | null;
  dropoffLocation: { lat: number; lng: number; address?: string } | null;
  route?: Array<[number, number]>;
  onRouteUpdate?: (route: { coordinates: Array<[number, number]>; distance: number; duration: number }) => void;
  showPickupRoute?: boolean;
  showDropoffRoute?: boolean;
  onDistanceUpdate?: (distance: number, duration: number, type: 'pickup' | 'dropoff') => void;
}

const mapContainerStyles: React.CSSProperties = {
  width: '100%',
  height: '100%',
  position: 'absolute' as const,  // Explicitly type as 'absolute'
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  overflow: 'hidden',
};

const globalStyles = `
  html, body, #__next {
    height: 100%;
    margin: 0;
    padding: 0;
    overflow: hidden;
    touch-action: none; /* Prevent pull-to-refresh and overscroll effects */
  }
  
  /* Prevent double-tap zoom on mobile */
  * {
    -webkit-tap-highlight-color: transparent;
    -webkit-touch-callout: none;
    -webkit-text-size-adjust: 100%; /* Prevent font scaling in landscape */
  }
  
  *:focus {
    outline: none !important;
  }
  
  /* Fix for mobile viewport units */
  @supports (-webkit-touch-callout: none) {
    .h-screen {
      height: -webkit-fill-available;
    }
  }
`;

const recenterButtonStyles: React.CSSProperties = {
  position: 'absolute',
  bottom: '20px',
  right: '20px',
  zIndex: 1000,
  backgroundColor: '#fff',
  border: '2px solid #ccc',
  borderRadius: '50%',
  width: '40px',
  height: '40px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
};

const Map = ({
  currentLocation,
  pickupLocation,
  dropoffLocation,
  route,
  onRouteUpdate,
  showPickupRoute = true,
  showDropoffRoute = true,
  onDistanceUpdate
}: MapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<{ [key: string]: mapboxgl.Marker }>({});
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [viewportHeight, setViewportHeight] = useState('100vh');
  const resizeTimeout = useRef<NodeJS.Timeout>();
  const [showRecenterButton, setShowRecenterButton] = useState(false);
  const isCentered = useRef(true);
  const currentZoom = useRef(14);
  const centerMarker = useRef<mapboxgl.Marker | null>(null);
  const userZoomed = useRef(false);
  const userInteracted = useRef(false);

  // Function to center map on current location
  const centerMap = useCallback(() => {
    if (map.current && currentLocation) {
      map.current.flyTo({
        center: [currentLocation.lng, currentLocation.lat],
        zoom: currentZoom.current,
        essential: true
      });
      isCentered.current = true;
      setShowRecenterButton(false);
    }
  }, [currentLocation]);

  // Function to handle map move events
  const handleMapMove = useCallback(() => {
    if (map.current) {
      userInteracted.current = true;
      userZoomed.current = true;
    }
  }, []);

  // Function to handle map load
  const handleMapLoad = useCallback((e: mapboxgl.MapboxEvent) => {
    const mapInstance = e.target;
    map.current = mapInstance;
    setIsMapLoaded(true);

    // Add event listeners for user interaction
    mapInstance.on('move', handleMapMove);
    mapInstance.on('zoom', handleMapMove);
    mapInstance.on('drag', handleMapMove);
    mapInstance.on('rotate', handleMapMove);
    mapInstance.on('pitch', handleMapMove);

    // Initial setup
    if (currentLocation) {
      mapInstance.flyTo({
        center: [currentLocation.lng, currentLocation.lat],
        zoom: 14,
        essential: true
      });
    }
  }, [currentLocation]);

  // Update map center when currentLocation changes, but only if user hasn't interacted
  useEffect(() => {
    if (map.current && currentLocation && !userInteracted.current) {
      map.current.flyTo({
        center: [currentLocation.lng, currentLocation.lat],
        zoom: map.current.getZoom(),
        essential: true
      });
    }
  }, [currentLocation?.lat, currentLocation?.lng]);

  // Update routes when locations change
  useEffect(() => {
    if (!isMapLoaded) return;
    updateRoutes();
  }, [currentLocation, pickupLocation, dropoffLocation, isMapLoaded, showPickupRoute, showDropoffRoute]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    // Store the initial center and zoom
    const initialCenter = currentLocation 
      ? [currentLocation.lng, currentLocation.lat] as [number, number]
      : [55.2708, 25.2048] as [number, number]; // Default to Dubai

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: initialCenter,
      zoom: 14,
      pitch: 0,
      bearing: 0,
      minZoom: 1,
      maxZoom: 18,
      renderWorldCopies: false,
      attributionControl: false,
      preserveDrawingBuffer: true,
      dragPan: true,
      boxZoom: false,
      dragRotate: false,
      keyboard: true,
      doubleClickZoom: false,
      touchPitch: false,
      touchZoomRotate: {
        around: 'center'
      },
      pitchWithRotate: false,
      cooperativeGestures: false,
      antialias: false,
      failIfMajorPerformanceCaveat: false,
      trackResize: false,
      refreshExpiredTiles: false,
      maxTileCacheSize: 100,
      transformRequest: (url, resourceType) => {
        if (resourceType === 'Tile' && url.startsWith('https://')) {
          return {
            url: url + (url.includes('?') ? '&' : '?') + 'fresh=' + Date.now()
          };
        }
        return { url };
      }
    });

    // Add navigation controls
    const nav = new mapboxgl.NavigationControl({
      showCompass: true,
      showZoom: true,
      visualizePitch: false,
    });
    
    map.current.addControl(nav, 'top-right');

    // Handle map load
    map.current.once('load', () => {
      setIsMapLoaded(true);
      
      // Add center marker
      if (currentLocation) {
        const el = document.createElement('div');
        el.className = 'center-marker';
        el.innerHTML = '📍';
        el.style.fontSize = '24px';
        el.style.transform = 'translate(-50%, -50%)';
        
        centerMarker.current = new mapboxgl.Marker({
          element: el,
          anchor: 'center'
        })
          .setLngLat([currentLocation.lng, currentLocation.lat])
          .addTo(map.current!);
      }

      // Track user interaction
      const interactionEvents = ['dragstart', 'zoomstart', 'rotatestart', 'mousedown', 'touchstart'];
      interactionEvents.forEach(event => {
        map.current?.on(event, () => {
          userInteracted.current = true;
          isCentered.current = false;
          setShowRecenterButton(true);
        });
      });
    });

    // Cleanup
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [currentLocation?.lat, currentLocation?.lng]);

  // Add styles for the center marker
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      .center-marker {
        width: 30px;
        height: 30px;
        background-color: #4285F4;
        border-radius: 50%;
        border: 2px solid white;
        transform: translate(-50%, -50%);
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Track user zoom interactions
  useEffect(() => {
    if (!map.current) return;

    const onZoom = () => {
      if (map.current) {
        userZoomed.current = true;
        currentZoom.current = map.current.getZoom();
      }
    };

    map.current.on('zoomstart', onZoom);
    map.current.on('zoom', onZoom);

    return () => {
      if (map.current) {
        map.current.off('zoomstart', onZoom);
        map.current.off('zoom', onZoom);
      }
    };
  }, [isMapLoaded]);

  // Reset zoom tracking when changing between pickup and dropoff
  useEffect(() => {
    userZoomed.current = false;
  }, [showPickupRoute, showDropoffRoute]);

  useEffect(() => {
    if (!map.current) return;
    updateMarkers();
  }, [currentLocation, pickupLocation, dropoffLocation]);

  const updateMarkers = () => {
    if (!map.current) return;

    if (currentLocation) {
      if (markers.current['current']) {
        markers.current['current'].remove();
      }

      const el = document.createElement('div');
      el.className = 'current-location-marker';
      el.innerHTML = `
        <style>
          @keyframes pulse {
            0% { transform: scale(0.5); opacity: 1; }
            70% { transform: scale(1.3); opacity: 0.7; }
            100% { transform: scale(1.4); opacity: 0.0; }
          }
          .pulse-dot {
            position: relative;
            width: 20px;
            height: 20px;
          }
          .pulse-dot:before, .pulse-dot:after {
            content: '';
            position: absolute;
            border: 2px solid #3b82f6;
            left: 0;
            right: 0;
            top: 0;
            bottom: 0;
            margin: auto;
            background: #3b82f6;
            border-radius: 50%;
            animation: pulse 2s linear infinite;
          }
          .pulse-dot:after {
            animation-delay: 1s;
          }
          .inner-dot {
            position: absolute;
            width: 12px;
            height: 12px;
            background: #3b82f6;
            border-radius: 50%;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            z-index: 2;
          }
        </style>
        <div class="pulse-dot">
          <div class="inner-dot"></div>
        </div>
      `;

      markers.current['current'] = new mapboxgl.Marker({
        element: el,
        anchor: 'center',
      })
        .setLngLat([currentLocation.lng, currentLocation.lat])
        .addTo(map.current);
    }

    if (pickupLocation) {
      if (markers.current['pickup']) {
        markers.current['pickup'].remove();
      }

      const el = document.createElement('div');
      el.className = 'pickup-marker';
      el.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center;">
          <div style="background: #3b82f6; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
              <path d="M12 2L4 12l8 10 8-10z"/>
            </svg>
          </div>
          <div style="background: white; color: #1f2937; padding: 2px 6px; border-radius: 4px; margin-top: 4px; font-size: 12px; font-weight: 600; white-space: nowrap; box-shadow: 0 1px 3px rgba(0,0,0,0.2);">
            Pick up
          </div>
        </div>
      `;

      markers.current['pickup'] = new mapboxgl.Marker({
        element: el,
        anchor: 'bottom',
      })
        .setLngLat([pickupLocation.lng, pickupLocation.lat])
        .addTo(map.current);
    }

    if (dropoffLocation) {
      if (markers.current['dropoff']) {
        markers.current['dropoff'].remove();
      }

      const el = document.createElement('div');
      el.className = 'dropoff-marker';
      el.innerHTML = `
        <div class="relative">
          <div class="w-8 h-8 bg-white rounded-full border-2 border-green-600 flex items-center justify-center">
            <div class="w-2 h-2 bg-green-600 rounded-full"></div>
          </div>
          <div class="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-white px-2 py-1 rounded text-xs font-medium whitespace-nowrap shadow-lg">
            Drop-off
          </div>
        </div>
      `;

      markers.current['dropoff'] = new mapboxgl.Marker({
        element: el,
        anchor: 'bottom',
      })
        .setLngLat([dropoffLocation.lng, dropoffLocation.lat])
        .addTo(map.current);
    }
  };

  const updateRoutes = async () => {
    if (!map.current || !currentLocation) return;
    
    const bounds: mapboxgl.LngLatBounds[] = [];
    
    // Helper function to update a single route
    const updateRoute = async (
      origin: [number, number],
      destination: [number, number],
      routeType: 'pickup' | 'dropoff'
    ): Promise<mapboxgl.LngLatBounds | null> => {
      if (!map.current) return null;
      
      const sourceId = `route-${routeType}`;
      const layerId = `route-${routeType}-layer`;
      
      try {
        // Format coordinates for the API request
        const coords = `${origin[0]},${origin[1]};${destination[0]},${destination[1]}`;
        
        // Make request to Mapbox Directions API
        const response = await fetch(
          `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}` +
          `?geometries=geojson` +
          `&overview=full` +
          `&access_token=${mapboxgl.accessToken}`
        );
        
        if (!response.ok) {
          throw new Error(`Failed to fetch ${routeType} route`);
        }
        
        const data = await response.json();
        
        if (!data.routes || data.routes.length === 0) {
          throw new Error('No route found');
        }
        
        const route = data.routes[0];
        const routeCoordinates = route.geometry.coordinates;
        
        // Calculate bounds for this route
        const routeBounds = routeCoordinates.reduce(
          (bounds: mapboxgl.LngLatBounds, coord: [number, number]) => 
            bounds.extend(coord as [number, number]),
          new mapboxgl.LngLatBounds(routeCoordinates[0] as [number, number], routeCoordinates[0] as [number, number])
        );
        
        // Add or update the route source and layer
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
              'line-color': routeType === 'pickup' ? '#3b82f6' : '#10b981',
              'line-width': 4,
              'line-opacity': 0.8
            }
          });
        }
        
        // Update distance and duration if callback provided
        if (onDistanceUpdate) {
          onDistanceUpdate(
            route.distance / 1000, // Convert meters to kilometers
            route.duration / 60,   // Convert seconds to minutes
            routeType
          );
        }
        
        return routeBounds;
        
      } catch (error) {
        console.error(`Error updating ${routeType} route:`, error);
        // Remove the route if it exists and there was an error
        if (map.current.getLayer(layerId)) map.current.removeLayer(layerId);
        if (map.current.getSource(sourceId)) map.current.removeSource(sourceId);
        return null;
      }
    };
    
    // Update pickup route if needed
    if (showPickupRoute && pickupLocation) {
      const pickupBounds = await updateRoute(
        [currentLocation.lng, currentLocation.lat],
        [pickupLocation.lng, pickupLocation.lat],
        'pickup'
      );
      if (pickupBounds) bounds.push(pickupBounds);
    } else if (map.current?.getLayer('route-pickup-layer')) {
      map.current.removeLayer('route-pickup-layer');
      if (map.current.getSource('route-pickup')) {
        map.current.removeSource('route-pickup');
      }
    }
    
    // Update dropoff route if needed
    if (showDropoffRoute && dropoffLocation) {
      const dropoffBounds = await updateRoute(
        [currentLocation.lng, currentLocation.lat],
        [dropoffLocation.lng, dropoffLocation.lat],
        'dropoff'
      );
      if (dropoffBounds) bounds.push(dropoffBounds);
    } else if (map.current?.getLayer('route-dropoff-layer')) {
      map.current.removeLayer('route-dropoff-layer');
      if (map.current.getSource('route-dropoff')) {
        map.current.removeSource('route-dropoff');
      }
    }
    
    // Fit map to show all routes and points of interest
    if (bounds.length > 0 && map.current) {
      const combinedBounds = bounds.reduce((combined, bound) => {
        return combined.extend(bound);
      }, new mapboxgl.LngLatBounds(bounds[0].getNorthWest(), bounds[0].getSouthEast()));
      
      // Only adjust view if user hasn't manually zoomed
      if (!userZoomed.current) {
        map.current.fitBounds(combinedBounds, {
          padding: { top: 100, bottom: 200, left: 50, right: 50 },
          maxZoom: 15,
          duration: 500 // Faster animation
        });
      } else {
        // If user has zoomed, just center the map on the route without changing zoom
        map.current.easeTo({
          center: combinedBounds.getCenter(),
          duration: 500,
          essential: true
        });
      }
    }
  };

  return (
    <div style={{ ...mapContainerStyles, height: viewportHeight }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
      {showRecenterButton && (
        <button 
          onClick={centerMap}
          style={recenterButtonStyles}
          title="Re-center on rider"
          aria-label="Re-center map on rider's location"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
            <path d="M12 8v8" />
            <path d="M8 12h8" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default Map;
