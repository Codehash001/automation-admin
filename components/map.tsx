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
  route: Array<[number, number]>;
  onRouteUpdate?: (route: Array<[number, number]>, distance: number, duration: number) => void;
  showPickupRoute?: boolean;
  showDropoffRoute?: boolean;
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
  }
  
  /* Prevent double-tap zoom on mobile */
  * {
    -webkit-tap-highlight-color: transparent;
    -webkit-touch-callout: none;
  }
  
  *:focus {
    outline: none !important;
  }
`;

export default function Map({ 
  currentLocation, 
  pickupLocation, 
  dropoffLocation, 
  route,
  onRouteUpdate,
  showPickupRoute = true,
  showDropoffRoute = true 
}: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<{ [key: string]: mapboxgl.Marker }>({});
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [viewportHeight, setViewportHeight] = useState('100vh');
  const resizeTimeout = useRef<NodeJS.Timeout>();

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
      center: [55.296249, 25.276987], // Default to Dubai coordinates
      zoom: 12,
      touchPitch: false, 
      touchZoomRotate: false, 
      dragRotate: false, 
      renderWorldCopies: false, 
      interactive: true,
      attributionControl: false, 
      preserveDrawingBuffer: true, 
      antialias: false, 
      trackResize: true,
      maxZoom: 18,
      minZoom: 10,
    });

    map.current.dragRotate.disable();
    map.current.touchZoomRotate.disableRotation();

    map.current.setMaxBounds([
      [54, 24], // Southwest coordinates of UAE
      [56.5, 26.5], // Northeast coordinates of UAE
    ]);

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

  const updateRoute = useCallback(() => {
    if (!map.current || !route || route.length === 0) return;
    
    const shouldShowRoute = (showPickupRoute || showDropoffRoute) && route.length > 0;
    
    if (shouldShowRoute) {
      if (map.current.getSource('route')) {
        (map.current.getSource('route') as mapboxgl.GeoJSONSource).setData({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: route,
          },
        });
      } else {
        map.current.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: route,
            },
          },
        });

        if (!map.current.getLayer('route')) {
          map.current.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': '#000000', 
              'line-width': 4,
              'line-opacity': 0.9,
            },
          });
        }
      }

      if (route.length > 0) {
        const bounds = new mapboxgl.LngLatBounds();
        
        if (currentLocation) {
          bounds.extend([currentLocation.lng, currentLocation.lat]);
        }
        
        if (showPickupRoute && pickupLocation) {
          bounds.extend([pickupLocation.lng, pickupLocation.lat]);
        }
        
        if (showDropoffRoute && dropoffLocation) {
          bounds.extend([dropoffLocation.lng, dropoffLocation.lat]);
        }
        
        if (!bounds.isEmpty()) {
          map.current.fitBounds(bounds, {
            padding: { top: 100, bottom: 100, left: 100, right: 100 },
            maxZoom: 15,
            duration: 1000
          });
        }
      }
    } else {
      if (map.current.getLayer('route')) {
        map.current.removeLayer('route');
      }
      if (map.current.getSource('route')) {
        map.current.removeSource('route');
      }
    }
  }, [route, showPickupRoute, showDropoffRoute, currentLocation, pickupLocation, dropoffLocation]);

  useEffect(() => {
    if (map.current?.isStyleLoaded()) {
      updateRoute();
    }
  }, [updateRoute]);

  useEffect(() => {
    if (!map.current) return;
    updateMarkers();
  }, [currentLocation, pickupLocation, dropoffLocation]);

  useEffect(() => {
    if (!map.current) return;
    
    const updateRoute = async () => {
      if (currentLocation && (pickupLocation || dropoffLocation)) {
        const destination = dropoffLocation || pickupLocation;
        if (destination) {
          const start: [number, number] = [currentLocation.lng, currentLocation.lat];
          const end: [number, number] = [destination.lng, destination.lat];
          const response = await fetch(
            `https://api.mapbox.com/directions/v5/mapbox/driving/${start[0]},${start[1]};${end[0]},${end[1]}?` + 
            `geometries=geojson&access_token=${mapboxgl.accessToken}`
          );
          const data = await response.json();
          if (data.routes && data.routes[0]) {
            const routeCoords = data.routes[0].geometry.coordinates;
            const distance = data.routes[0].distance; 
            const duration = data.routes[0].duration; 
            const formattedRoute = routeCoords.map((coord: number[]) => [coord[0], coord[1]] as [number, number]);
            if (onRouteUpdate) {
              onRouteUpdate(formattedRoute, distance, duration);
            }
          }
        }
      }
    };
    
    updateRoute();
  }, [currentLocation, pickupLocation, dropoffLocation, onRouteUpdate]);

  useEffect(() => {
    if (!map.current || !pickupLocation || !dropoffLocation) return;

    const bounds = new mapboxgl.LngLatBounds()
      .extend([pickupLocation.lng, pickupLocation.lat])
      .extend([dropoffLocation.lng, dropoffLocation.lat]);
    
    const padding = {
      top: 50,
      bottom: 100, 
      left: 50,
      right: 50,
    };

    map.current.fitBounds(bounds, {
      padding,
      maxZoom: 15,
      duration: 1000, 
    });
  }, [pickupLocation, dropoffLocation]);

  useEffect(() => {
    if (!isMapLoaded || !pickupLocation || !dropoffLocation) return;
    
    const timer = setTimeout(() => {
      const bounds = new mapboxgl.LngLatBounds()
        .extend([pickupLocation.lng, pickupLocation.lat])
        .extend([dropoffLocation.lng, dropoffLocation.lat]);
      
      const padding = {
        top: 50,
        bottom: 100, 
        left: 50,
        right: 50,
      };

      map.current?.fitBounds(bounds, {
        padding,
        maxZoom: 15,
        duration: 1000, 
      });
    }, 100);
    
    return () => clearTimeout(timer);
  }, [isMapLoaded, pickupLocation, dropoffLocation]);

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
