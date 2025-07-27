'use client';

import { useEffect, useRef, useCallback } from 'react';
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
}

export default function Map({ 
  currentLocation, 
  pickupLocation, 
  dropoffLocation, 
  route,
  onRouteUpdate 
}: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<{ [key: string]: mapboxgl.Marker }>({});
  const routeLayer = useRef<mapboxgl.LineLayer | null>(null);
  const routeSource = useRef<mapboxgl.GeoJSONSource | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) return;
    if (map.current) return; // initialize map only once

    // Create map instance
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v11', // Default style
      center: [55.296249, 25.276987], // Default to Dubai coordinates
      zoom: 12,
    });

    // Add navigation control
    map.current.addControl(new mapboxgl.NavigationControl());

    // Add geolocate control
    const geolocate = new mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true,
      },
      trackUserLocation: true,
      showUserHeading: true,
    });
    map.current.addControl(geolocate);

    // Add fullscreen control
    map.current.addControl(new mapboxgl.FullscreenControl());

    // Add scale control
    map.current.addControl(new mapboxgl.ScaleControl());

    // Cleanup on unmount
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Update map style based on user preference
  useEffect(() => {
    if (!map.current) return;

    // Add style toggle button
    const styleToggle = document.createElement('div');
    styleToggle.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
    styleToggle.innerHTML = `
      <button type="button" title="Toggle satellite view" class="p-2">
        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" stroke-width="2">
          <path d="M3 6l9-4 9 4m-9-4v20m-9-8v8h18v-8m-9 0v12m-9-4l9 4 9-4"></path>
        </svg>
      </button>
    `;

    // Add event listener for style toggle
    styleToggle.addEventListener('click', () => {
      if (!map.current) return;
      
      const currentStyle = map.current.getStyle().name || '';
      if (currentStyle.includes('satellite')) {
        map.current.setStyle('mapbox://styles/mapbox/streets-v11');
      } else {
        map.current.setStyle('mapbox://styles/mapbox/satellite-streets-v11');
      }
    });

    // Add the control to the map
    map.current.addControl({
      onAdd: () => styleToggle,
      onRemove: () => styleToggle.remove(),
    }, 'top-right');

    return () => {
      if (map.current && styleToggle.parentNode) {
        styleToggle.remove();
      }
    };
  }, []);

  // Fetch route from Mapbox Directions API
  const fetchRoute = useCallback(async (start: [number, number], end: [number, number]) => {
    if (!map.current) return null;
    
    try {
      const coordinates = `${start[0]},${start[1]};${end[0]},${end[1]}`;
      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?` + 
        `geometries=geojson&access_token=${mapboxgl.accessToken}`
      );
      
      const data = await response.json();
      
      if (data.routes && data.routes[0]) {
        const routeCoords = data.routes[0].geometry.coordinates;
        const distance = data.routes[0].distance; // in meters
        const duration = data.routes[0].duration; // in seconds
        
        // Convert GeoJSON coordinates to the format expected by our component
        const formattedRoute = routeCoords.map((coord: number[]) => [coord[0], coord[1]] as [number, number]);
        
        // Notify parent component about the updated route
        if (onRouteUpdate) {
          onRouteUpdate(formattedRoute, distance, duration);
        }
        
        return formattedRoute;
      }
      return null;
    } catch (error) {
      console.error('Error fetching route:', error);
      return null;
    }
  }, []);

  // Add or update markers
  const updateMarkers = () => {
    if (!map.current) return;

    // Add or update current location marker
    if (currentLocation) {
      if (!markers.current['current']) {
        const el = document.createElement('div');
        el.className = 'current-location-marker';
        el.innerHTML = `
          <div class="relative">
            <div class="absolute w-4 h-4 bg-blue-500 rounded-full border-2 border-white animate-ping"></div>
            <div class="absolute w-4 h-4 bg-blue-600 rounded-full border-2 border-white"></div>
          </div>
        `;

        markers.current['current'] = new mapboxgl.Marker({
          element: el,
          anchor: 'center',
        })
          .setLngLat([currentLocation.lng, currentLocation.lat])
          .addTo(map.current);
      } else {
        markers.current['current'].setLngLat([currentLocation.lng, currentLocation.lat]);
      }
    }

    // Add or update pickup marker
    if (pickupLocation) {
      if (!markers.current['pickup']) {
        const el = document.createElement('div');
        el.className = 'pickup-marker';
        el.innerHTML = `
          <div class="relative">
            <div class="w-8 h-8 bg-white rounded-full border-2 border-blue-600 flex items-center justify-center">
              <div class="w-2 h-2 bg-blue-600 rounded-full"></div>
            </div>
            <div class="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-white px-2 py-1 rounded text-xs font-medium whitespace-nowrap shadow-lg">
              Pickup
            </div>
          </div>
        `;

        markers.current['pickup'] = new mapboxgl.Marker({
          element: el,
          anchor: 'bottom',
        })
          .setLngLat([pickupLocation.lng, pickupLocation.lat])
          .addTo(map.current);
      } else {
        markers.current['pickup'].setLngLat([pickupLocation.lng, pickupLocation.lat]);
      }
    }

    // Add or update dropoff marker
    if (dropoffLocation) {
      if (!markers.current['dropoff']) {
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
      } else {
        markers.current['dropoff'].setLngLat([dropoffLocation.lng, dropoffLocation.lat]);
      }
    }
  };

  // Add or update route line
  const updateRoute = () => {
    if (!map.current || route.length < 2) return;

    // Create a GeoJSON source and layer for the route if they don't exist
    if (!routeSource.current) {
      // Add source for the route
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

      // Add layer for the route line
      map.current.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#3b82f6', // blue-500
          'line-width': 4,
          'line-opacity': 0.8,
        },
      });

      routeLayer.current = map.current.getLayer('route') as mapboxgl.LineLayer;
      routeSource.current = map.current.getSource('route') as mapboxgl.GeoJSONSource;
    } else {
      // Update the existing route data
      (routeSource.current as any).setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: route,
        },
      });
    }
  };

  // Fit map to show all markers and route
  const fitMapToMarkers = () => {
    if (!map.current || (!currentLocation && !pickupLocation && !dropoffLocation)) return;

    const bounds = new mapboxgl.LngLatBounds();

    if (currentLocation) {
      bounds.extend([currentLocation.lng, currentLocation.lat]);
    }
    if (pickupLocation) {
      bounds.extend([pickupLocation.lng, pickupLocation.lat]);
    }
    if (dropoffLocation) {
      bounds.extend([dropoffLocation.lng, dropoffLocation.lat]);
    }

    // If we have a route, include all points in the bounds
    if (route.length > 0) {
      route.forEach(coord => {
        bounds.extend(coord as [number, number]);
      });
    }

    // Add some padding around the bounds
    map.current.fitBounds(bounds, {
      padding: 100,
      maxZoom: 15,
      duration: 1000,
    });
  };

  // Update markers when locations change
  useEffect(() => {
    if (!map.current) return;
    updateMarkers();
  }, [currentLocation, pickupLocation, dropoffLocation]);

  // Update route when it changes
  useEffect(() => {
    if (!map.current) return;
    
    // Wait for the map to load
    const onStyleLoad = () => {
      updateRoute();
      map.current?.off('style.load', onStyleLoad);
    };

    if (map.current.isStyleLoaded()) {
      updateRoute();
    } else {
      map.current.on('style.load', onStyleLoad);
    }
  }, [route]);

  // Update route when locations change
  useEffect(() => {
    if (!map.current) return;
    
    const updateRoute = async () => {
      // If we have both current location and a destination, fetch the route
      if (currentLocation && (pickupLocation || dropoffLocation)) {
        const destination = dropoffLocation || pickupLocation;
        if (destination) {
          const start: [number, number] = [currentLocation.lng, currentLocation.lat];
          const end: [number, number] = [destination.lng, destination.lat];
          await fetchRoute(start, end);
        }
      }
    };
    
    updateRoute();
  }, [currentLocation, pickupLocation, dropoffLocation, fetchRoute]);

  // Fit map to markers when they change
  useEffect(() => {
    if (!map.current) return;
    
    const timeout = setTimeout(() => {
      fitMapToMarkers();
    }, 100);

    return () => clearTimeout(timeout);
  }, [currentLocation, pickupLocation, dropoffLocation, route]);

  return (
    <div 
      ref={mapContainer} 
      className="w-full h-full"
    />
  );
}

// Add global styles for the map container
const styles = `
  .mapboxgl-ctrl-top-right {
    top: 10px;
    right: 10px;
  }
  
  .mapboxgl-ctrl-group {
    background: #fff;
    border-radius: 4px;
    box-shadow: 0 0 0 2px rgba(0,0,0,.1);
  }
  
  .mapboxgl-ctrl button {
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    background: none;
    border: none;
    outline: none;
  }
  
  .mapboxgl-ctrl button:hover {
    background-color: #f3f4f6;
  }
  
  .current-location-marker {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    transform: translate(-50%, -50%);
  }
  
  .pickup-marker, .dropoff-marker {
    transform: translate(-50%, -100%);
  }
`;

// Add styles to the document head
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);
}
