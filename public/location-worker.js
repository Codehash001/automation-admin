// Service Worker for background location tracking
let watchId = null;

// Listen for messages from the page
self.addEventListener('message', (event) => {
  if (event.data.type === 'START_LOCATION_TRACKING') {
    const { deliveryId, interval = 10000 } = event.data;
    
    // Clear any existing watcher
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
    }
    
    // Start watching position
    watchId = navigator.geolocation.watchPosition(
      (position) => {
        // Send location to server
        fetch('/api/deliveries', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: deliveryId,
            liveLocation: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              updatedAt: new Date().toISOString()
            }
          })
        }).catch(error => {
          console.error('Failed to update location:', error);
        });
      },
      (error) => {
        console.error('Geolocation error:', error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000
      }
    );
    
    // Send message back to confirm tracking started
    event.ports[0].postMessage({ status: 'TRACKING_STARTED' });
  } else if (event.data.type === 'STOP_LOCATION_TRACKING') {
    // Stop watching position
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
      
      // Send message back to confirm tracking stopped
      event.ports[0].postMessage({ status: 'TRACKING_STOPPED' });
    }
  }
});