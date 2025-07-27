// Service Worker for background location tracking
let watchId = null;
let isTracking = false;

// Add event listener for background fetch (iOS)
self.addEventListener('fetch', (event) => {
  // This is needed to keep the service worker alive on iOS
  if (event.request.url.includes('/api/deliveries')) {
    event.respondWith(
      fetch(event.request).catch(error => {
        console.error('Background fetch failed:', error);
        return new Response(JSON.stringify({ error: 'Background sync failed' }), {
          status: 408,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
  }
});

// Listen for messages from the page
self.addEventListener('message', (event) => {
  if (event.data.type === 'START_LOCATION_TRACKING') {
    const { deliveryId, interval = 15000, authToken } = event.data;
    
    // If already tracking, stop the current tracking first
    if (isTracking) {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
    }
    
    // Start watching position
    watchId = navigator.geolocation.watchPosition(
      async (position) => {
        try {
          // Send location to server
          const response = await fetch('/api/deliveries', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken || process.env.NEXT_PUBLIC_API_KEY}`
            },
            body: JSON.stringify({
              id: deliveryId,
              liveLocation: {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: new Date().toISOString(),
                isBackground: true
              }
            })
          });
          
          if (!response.ok) {
            const error = await response.json();
            console.error('Failed to update location:', error);
            // Notify the client about the error
            self.clients.matchAll().then(clients => {
              clients.forEach(client => {
                client.postMessage({
                  type: 'LOCATION_UPDATE_ERROR',
                  error: error.message || 'Failed to update location'
                });
              });
            });
          } else {
            // Notify the client about successful update
            self.clients.matchAll().then(clients => {
              clients.forEach(client => {
                client.postMessage({
                  type: 'LOCATION_UPDATED',
                  location: {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: new Date().toISOString()
                  }
                });
              });
            });
          }
        } catch (error) {
          console.error('Error updating location:', error);
        }
      },
      (error) => {
        console.error('Geolocation error in service worker:', error);
        // Notify the client about the error
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'LOCATION_ERROR',
              error: error.message || 'Failed to get location'
            });
          });
        });
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000
      }
    );
    
    isTracking = true;
    
    // Send message back to confirm tracking started
    event.ports[0]?.postMessage({ 
      status: 'TRACKING_STARTED',
      watchId: watchId
    });
    
  } else if (event.data.type === 'STOP_LOCATION_TRACKING') {
    // Stop watching position
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
      isTracking = false;
      
      // Send message back to confirm tracking stopped
      event.ports[0]?.postMessage({ 
        status: 'TRACKING_STOPPED',
        watchId: watchId
      });
    }
  }
});

// Self-terminate when idle (iOS)
let timeoutId;
const resetTimeout = () => {
  if (timeoutId) clearTimeout(timeoutId);
  // Keep the service worker alive for 5 minutes of inactivity
  timeoutId = setTimeout(() => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
    self.registration.unregister();
  }, 5 * 60 * 1000); // 5 minutes
};

// Reset the timeout whenever we get a message
self.addEventListener('message', resetTimeout);
resetTimeout();