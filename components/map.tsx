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

export default function Map({ 
  currentLocation, 
  pickupLocation, 
  dropoffLocation, 
  route,
  onRouteUpdate,
  showPickupRoute = true,
  showDropoffRoute = true,
  onDistanceUpdate
}: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<{ [key: string]: mapboxgl.Marker }>({});
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [viewportHeight, setViewportHeight] = useState('100vh');
  const resizeTimeout = useRef<NodeJS.Timeout>();

  // Track if the user has manually zoomed
  const userZoomed = useRef(false);
  const currentZoom = useRef(14); // Default zoom level

  useEffect(() => {
    const setHeight = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
      setViewportHeight('calc(var(--vh, 1vh) * 100)');
    };

    setHeight();

    const handleResize = () => {
      if (resizeTimeout.current) {
        clearTimeout(resizeTimeout.current);
      }
      resizeTimeout.current = setTimeout(() => {
        setHeight();
        if (map.current) {
          setTimeout(() => {
            map.current?.resize();
          }, 100);
        }
      }, 200);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    const styleElement = document.createElement('style');
    styleElement.innerHTML = globalStyles;
    document.head.appendChild(styleElement);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      if (resizeTimeout.current) {
        clearTimeout(resizeTimeout.current);
      }
      document.head.removeChild(styleElement);
    };
  }, []);

  useEffect(() => {
    if (!mapContainer.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [55.296249, 25.276987], // Default to Dubai
      zoom: 14, // Default zoom level
      minZoom: 10, // Prevent zooming out too far
      maxZoom: 20, // Allow close zooming
      touchPitch: false, 
      touchZoomRotate: true, // Allow zoom and rotate on touch devices
      dragRotate: false, 
      renderWorldCopies: true, // Show multiple copies of the world at low zoom levels
      interactive: true,
      attributionControl: false, 
      preserveDrawingBuffer: true, 
      antialias: true, // Enable antialiasing for better rendering
      trackResize: true,
    });

    map.current.dragRotate.disable();
    map.current.touchZoomRotate.disableRotation();

    map.current.on('load', () => {
      setIsMapLoaded(true);
      
      map.current?.addControl(
        new mapboxgl.NavigationControl({
          showCompass: false, 
          showZoom: true,
          visualizePitch: false,
        }),
        'top-right'
      );

      setTimeout(() => {
        map.current?.resize();
      }, 0);
    });

    map.current.on('error', (e) => {
      console.error('Map error:', e.error);
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

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

  // Function to update the route between two points
  const updateRoute = useCallback(async (start: [number, number], end: [number, number], type: 'pickup' | 'dropoff') => {
    if (!map.current || !start || !end) return null;

    try {
      const startCoords = `${start[0]},${start[1]}`;
      const endCoords = `${end[0]},${end[1]}`;
      
      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${startCoords};${endCoords}?` +
        `geometries=geojson&access_token=${mapboxgl.accessToken}&overview=full`
      );

      const data = await response.json();
      
      if (data.routes && data.routes[0]) {
        const route = data.routes[0];
        const distance = route.distance; // in meters
        const duration = route.duration; // in seconds
        const coordinates = route.geometry.coordinates;
        const routeId = `route-${type}`;
        
        // Update the route line
        if (map.current.getSource(routeId)) {
          (map.current.getSource(routeId) as mapboxgl.GeoJSONSource).setData({
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: coordinates
            }
          });
        } else {
          map.current.addSource(routeId, {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: coordinates
              }
            }
          });

          map.current.addLayer({
            id: routeId,
            type: 'line',
            source: routeId,
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': type === 'pickup' ? '#3b82f6' : '#000000',
              'line-width': 4,
              'line-opacity': 0.8
            }
          });
        }

        // Call the onRouteUpdate callback if provided
        if (onRouteUpdate) {
          onRouteUpdate({
            coordinates,
            distance,
            duration
          });
        }

        // Call the onDistanceUpdate callback if provided
        if (onDistanceUpdate) {
          onDistanceUpdate(distance, duration, type);
        }

        // Return the bounds for this route
        const bounds = coordinates.reduce((bounds: any, coord: [number, number]) => {
          return bounds.extend(coord);
        }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));

        return bounds;
      }
    } catch (error) {
      console.error(`Error updating ${type} route:`, error);
    }
    return null;
  }, [onRouteUpdate, onDistanceUpdate]);

  // Update route when current location or target location changes
  useEffect(() => {
    if (!isMapLoaded || !currentLocation) return;

    const updateRoutes = async () => {
      if (!map.current) return;
      
      // Get current zoom level if user has manually zoomed
      if (map.current.getZoom) {
        currentZoom.current = map.current.getZoom();
      }
      
      const bounds: mapboxgl.LngLatBounds[] = [];
      
      // Update pickup route if needed
      if (showPickupRoute && pickupLocation) {
        const pickupBounds = await updateRoute(
          [currentLocation.lng, currentLocation.lat],
          [pickupLocation.lng, pickupLocation.lat],
          'pickup'
        );
        if (pickupBounds) bounds.push(pickupBounds);
      } else if (map.current?.getSource('route-pickup')) {
        if (map.current.getLayer('route-pickup')) map.current.removeLayer('route-pickup');
        if (map.current.getSource('route-pickup')) map.current.removeSource('route-pickup');
      }
      
      // Update dropoff route if needed
      if (showDropoffRoute && dropoffLocation) {
        const dropoffBounds = await updateRoute(
          [currentLocation.lng, currentLocation.lat],
          [dropoffLocation.lng, dropoffLocation.lat],
          'dropoff'
        );
        if (dropoffBounds) bounds.push(dropoffBounds);
      } else if (map.current?.getSource('route-dropoff')) {
        if (map.current.getLayer('route-dropoff')) map.current.removeLayer('route-dropoff');
        if (map.current.getSource('route-dropoff')) map.current.removeSource('route-dropoff');
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

    updateRoutes();
    
    // Update route every 10 seconds or when location changes significantly
    const interval = setInterval(updateRoutes, 10000);
    return () => clearInterval(interval);
  }, [currentLocation, pickupLocation, dropoffLocation, isMapLoaded, showPickupRoute, showDropoffRoute, updateRoute]);

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

  return (
    <div 
      ref={mapContainer} 
      style={{
        ...mapContainerStyles,
        height: viewportHeight,
      }}
      className="map-container"
    />
  );
}
