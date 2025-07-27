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
  showPickupRoute?: boolean;
  showDropoffRoute?: boolean;
}

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
  const routeLayer = useRef<mapboxgl.LineLayer | null>(null);
  const routeSource = useRef<mapboxgl.GeoJSONSource | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) return;
    if (map.current) return; // initialize map only once

    // Create map instance
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [55.296249, 25.276987], // Default to Dubai coordinates
      zoom: 12,
      attributionControl: false,
    });

    // Wait for the map to load before adding sources and layers
    map.current.on('load', () => {
      // Add navigation control with only zoom buttons
      map.current?.addControl(new mapboxgl.NavigationControl({
        showCompass: false,
        showZoom: true,
        visualizePitch: false
      }));

      // Add geolocate control
      const geolocate = new mapboxgl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true,
        },
        trackUserLocation: true,
        showUserHeading: true,
        showAccuracyCircle: false,
      });
      map.current?.addControl(geolocate);

      // Add fullscreen control
      map.current?.addControl(new mapboxgl.FullscreenControl());

      // Set a flag to indicate map is loaded
      map.current?.on('style.load', () => {
        // Now we can safely add sources and layers
        updateRoute();
      });
    });

    // Cleanup on unmount
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Add or update markers
  const updateMarkers = () => {
    if (!map.current) return;

    // Add or update current location marker with pulse effect
    if (currentLocation) {
      // Remove existing marker if it exists
      if (markers.current['current']) {
        markers.current['current'].remove();
      }

      // Create a new marker element
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

      // Create and add the marker
      markers.current['current'] = new mapboxgl.Marker({
        element: el,
        anchor: 'center',
      })
        .setLngLat([currentLocation.lng, currentLocation.lat])
        .addTo(map.current);
    }

    // Add or update pickup marker with label
    if (pickupLocation) {
      // Remove existing marker if it exists
      if (markers.current['pickup']) {
        markers.current['pickup'].remove();
      }

      // Create a new marker element
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

      // Create and add the marker
      markers.current['pickup'] = new mapboxgl.Marker({
        element: el,
        anchor: 'bottom',
      })
        .setLngLat([pickupLocation.lng, pickupLocation.lat])
        .addTo(map.current);
    }

    // Add or update dropoff marker
    if (dropoffLocation) {
      // Remove existing marker if it exists
      if (markers.current['dropoff']) {
        markers.current['dropoff'].remove();
      }

      // Create a new marker element
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

      // Create and add the marker
      markers.current['dropoff'] = new mapboxgl.Marker({
        element: el,
        anchor: 'bottom',
      })
        .setLngLat([dropoffLocation.lng, dropoffLocation.lat])
        .addTo(map.current);
    }
  };

  // Add a function to update the route that can be called safely
  const updateRoute = useCallback(() => {
    if (!map.current || !route || route.length === 0) return;
    
    const shouldShowRoute = (showPickupRoute || showDropoffRoute) && route.length > 0;
    
    if (shouldShowRoute) {
      // Check if the source already exists
      if (map.current.getSource('route')) {
        // Update existing source
        (map.current.getSource('route') as mapboxgl.GeoJSONSource).setData({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: route,
          },
        });
      } else {
        // Add new source and layer
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
              'line-color': '#000000', // Black color for the route
              'line-width': 4,
              'line-opacity': 0.9,
            },
          });
        }
      }

      // Fit map to show all markers and route
      if (route.length > 0) {
        const bounds = new mapboxgl.LngLatBounds();
        
        // Add current location if available
        if (currentLocation) {
          bounds.extend([currentLocation.lng, currentLocation.lat]);
        }
        
        // Add pickup location if showing pickup route
        if (showPickupRoute && pickupLocation) {
          bounds.extend([pickupLocation.lng, pickupLocation.lat]);
        }
        
        // Add dropoff location if showing dropoff route
        if (showDropoffRoute && dropoffLocation) {
          bounds.extend([dropoffLocation.lng, dropoffLocation.lat]);
        }
        
        // If we have a valid bounds, fit the map to it
        if (!bounds.isEmpty()) {
          map.current.fitBounds(bounds, {
            padding: { top: 100, bottom: 100, left: 100, right: 100 },
            maxZoom: 15,
            duration: 1000
          });
        }
      }
    } else {
      // Remove the route layer and source if they exist
      if (map.current.getLayer('route')) {
        map.current.removeLayer('route');
      }
      if (map.current.getSource('route')) {
        map.current.removeSource('route');
      }
    }
  }, [route, showPickupRoute, showDropoffRoute, currentLocation, pickupLocation, dropoffLocation]);

  // Call updateRoute when route or visibility changes
  useEffect(() => {
    if (map.current?.isStyleLoaded()) {
      updateRoute();
    }
  }, [updateRoute]);

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

  // Update markers when locations change
  useEffect(() => {
    if (!map.current) return;
    updateMarkers();
  }, [currentLocation, pickupLocation, dropoffLocation]);

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

  // Always show route when we have both pickup and dropoff
  useEffect(() => {
    if (!map.current || !pickupLocation || !dropoffLocation) return;

    // Remove existing route source/layer if they exist
    if (map.current.getSource('route')) {
      map.current.removeLayer('route');
      map.current.removeSource('route');
    }

    // Get route between pickup and dropoff
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${pickupLocation.lng},${pickupLocation.lat};${dropoffLocation.lng},${dropoffLocation.lat}?geometries=geojson&access_token=${mapboxgl.accessToken}`;

    fetch(url)
      .then(response => response.json())
      .then(data => {
        const route = data.routes[0].geometry;
        
        map.current.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: route
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
            'line-color': '#000',
            'line-width': 4,
            'line-opacity': 0.8
          }
        });

        // Fit map to show both points with padding
        const bounds = new mapboxgl.LngLatBounds()
          .extend([pickupLocation.lng, pickupLocation.lat])
          .extend([dropoffLocation.lng, dropoffLocation.lat]);
        
        map.current.fitBounds(bounds, {
          padding: 100,
          maxZoom: 15
        });
      })
      .catch(error => console.error('Error fetching route:', error));
  }, [map, pickupLocation, dropoffLocation]);

  // Fit map to markers when they change
  useEffect(() => {
    if (!map.current) return;
    
    const timeout = setTimeout(() => {
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
