// app/dashboard/deliveries/live/[deliveryId]/page.tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';

interface Location {
  lat: number;
  lng: number;
}

export default function LiveLocationSharing({ params }: { params: { deliveryId: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [otp, setOtp] = useState('');
  const [showOtpForm, setShowOtpForm] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [location, setLocation] = useState<Location | null>(null);
  const watchId = useRef<number | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState('');
  const [serviceWorkerRegistered, setServiceWorkerRegistered] = useState(false);
  

  

  const sendLocationToServer = async (latitude: number, longitude: number) => {
    try {

      const response = await fetch('/api/deliveries', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_API_KEY}`
        },
        body: JSON.stringify({
          id: parseInt(params.deliveryId), // Include delivery ID in the request body
          liveLocation: {
            latitude,
            longitude,
            updatedAt: new Date().toISOString()
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to update location:', errorData);
        throw new Error(errorData.error || 'Failed to update location');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error sending location:', error);
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update your location. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  // Register service worker on component mount
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/location-worker.js')
        .then(registration => {
          console.log('ServiceWorker registration successful');
          setServiceWorkerRegistered(true);
        })
        .catch(err => {
          console.error('ServiceWorker registration failed:', err);
          setError('Failed to enable background location tracking');
        });
    }

    // Cleanup service worker on unmount
    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          registrations.forEach(registration => {
            registration.unregister();
          });
        });
      }
    };
  }, []);

  // Check for OTP in URL
  useEffect(() => {
    const otpParam = searchParams.get('otp');
    if (otpParam) {
      setOtp(otpParam);
      verifyOtp(otpParam);
    }
  }, [searchParams]);

  const verifyOtp = async (otpToVerify?: string) => {
    const otpValue = otpToVerify || otp;
    if (!otpValue) {
      toast({
        title: "Error",
        description: "Please enter OTP",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/deliveries/otp', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ otp: otpValue }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Invalid OTP');
      }

      if (data.deliveryId != params.deliveryId) {
        throw new Error('Invalid delivery');
      }

      setIsVerified(true);
      setShowOtpForm(false);
      toast({
        title: "Success",
        description: "OTP verified successfully",
      });
      
      // Start sharing location immediately after successful verification
      startSharingLocation();
    } catch (error) {
      console.error('Error verifying OTP:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to verify OTP',
        variant: "destructive",
      });
      return;
    } finally {
      setIsLoading(false);
    }
  };

  const handleLocationPermission = () => {
    // This function will be called when the user clicks the button in the toast
    if (navigator.permissions) {
      // This will open the browser's permission settings
      navigator.permissions.query({ name: 'geolocation' });
    }
    // Force a new permission prompt
    startSharingLocation();
  };

  const startSharingLocation = async () => {
    console.log('1. Start sharing location called');
    try {
      console.log('2. Checking geolocation support');
      if (navigator.geolocation) {
        console.log('3. Geolocation is supported');
        
        // First check if we already have permission
        console.log('4. Checking permissions');
        let permissionStatus;
        try {
          // @ts-ignore - TypeScript doesn't know about the permission API yet
          permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
          console.log('5. Permission status:', permissionStatus.state);
          
          if (permissionStatus.state === 'denied') {
            console.log('6. Permission was denied - showing instructions');
            toast({
              title: "Location Access Required",
              description: (
                <div className="flex flex-col gap-2">
                  <p>Location access is required to share your live location.</p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      // This will open the browser's permission settings
                      if (navigator.permissions) {
                        navigator.permissions.query({ name: 'geolocation' });
                      }
                      // Try again after a short delay
                      setTimeout(startSharingLocation, 500);
                    }}
                  >
                    Allow Location Access
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Click the lock icon in your browser's address bar to manage permissions.
                  </p>
                </div>
              ),
              variant: "destructive",
              duration: 10000, // Show for 10 seconds
            });
            return;
          }
        } catch (permError) {
          console.warn('Permission API error, continuing anyway:', permError);
        }

        // Request location access
        console.log('7. Requesting location access');
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              console.log('8. Got position:', pos);
              resolve(pos);
            },
            (err) => {
              console.error('8. Error getting position:', err);
              if (err.code === err.PERMISSION_DENIED) {
                toast({
                  title: "Permission Required",
                  description: (
                    <div className="flex flex-col gap-2">
                      <p>Please allow location access to continue.</p>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => window.location.reload()} // Refresh to trigger permission prompt again
                      >
                        Try Again
                      </Button>
                    </div>
                  ),
                  variant: "destructive"
                });
              }
              reject(err);
            },
            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0
            }
          );
        });

        // If we get here, we have permission
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
  
        // Start watching position
        const id = navigator.geolocation.watchPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            setLocation({ lat: latitude, lng: longitude });
            
            // Send location to server
            sendLocationToServer(latitude, longitude);
          },
          (error) => {
            console.error('Error watching position:', error);
            if (error.code === error.PERMISSION_DENIED) {
              toast({
                title: "Location Access Required",
                description: "Please allow location access to share your live location.",
                variant: "destructive"
              });
            }
          },
          { enableHighAccuracy: true }
        );
        
        // Store the watch ID
        watchId.current = id;

        setIsSharing(true);
        toast({
          title: "Location Sharing Started",
          description: "Your live location is now being shared.",
        });
  
      } else {
        toast({
          title: "Geolocation not supported",
          description: "Your browser doesn't support geolocation.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error initializing location sharing:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to access location",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, []);

  // Helper function to start regular geolocation watch (fallback)
  const startRegularGeolocationWatch = () => {
    console.log('Starting regular geolocation watch as fallback');
    const id = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setLocation({ lat: latitude, lng: longitude });
        await sendLocationToServer(latitude, longitude);
      },
      (error) => {
        console.error('Geolocation error:', error);
        toast({
          title: "Location Error",
          description: "Unable to get your location. Please ensure location services are enabled.",
          variant: "destructive",
        });
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,  // Accept a position whose age is no more than 10 seconds
        timeout: 5000,      // Time to wait for a position (5 seconds)
      }
    );
    watchId.current = id;
  };

  const stopSharingLocation = async () => {
    console.log('Stopping location sharing...');
    
    // Create a timeout to ensure we don't get stuck
    const stopTimeout = setTimeout(() => {
      console.warn('Stop operation taking too long, forcing cleanup');
      forceCleanup();
    }, 2000); // 2 second timeout

    const forceCleanup = () => {
      // Clear the geolocation watch if it exists
      if (watchId.current !== null && watchId.current !== -1) {
        console.log('Force clearing geolocation watch with ID:', watchId.current);
        try {
          navigator.geolocation.clearWatch(watchId.current);
        } catch (e) {
          console.error('Error force clearing watch:', e);
        }
      }
      
      // Reset state
      watchId.current = null;
      setLocation(null);
      setIsSharing(false);
    };
    
    try {
      // Clear the geolocation watch if it exists
      if (watchId.current !== null && watchId.current !== -1) {
        console.log('Clearing geolocation watch with ID:', watchId.current);
        navigator.geolocation.clearWatch(watchId.current);
      } else {
        console.log('No active geolocation watch to clear');
      }
      
      // Stop service worker tracking if active - don't await this
      if (watchId.current === -1 || serviceWorkerRegistered) {
        console.log('Attempting to stop service worker tracking...');
        
        // Don't wait for this to complete
        const stopServiceWorker = async () => {
          try {
            if ('serviceWorker' in navigator) {
              const registration = await navigator.serviceWorker.ready;
              if (registration.active) {
                // Add a timeout for the service worker message
                const messagePromise = new Promise((resolve) => {
                  const messageChannel = new MessageChannel();
                  messageChannel.port1.onmessage = (event) => {
                    if (event.data === 'STOP_ACK') {
                      console.log('Received STOP_ACK from service worker');
                      messageChannel.port1.close();
                      resolve(true);
                    }
                  };
                  
                  // Send the stop message
                  registration.active?.postMessage(
                    { type: 'STOP_TRACKING' },
                    [messageChannel.port2]
                  );
                  
                  // Set a timeout in case the service worker doesn't respond
                  setTimeout(() => {
                    console.warn('Service worker did not respond to STOP_TRACKING');
                    messageChannel.port1.close();
                    resolve(false);
                  }, 1000);
                });
                
                await messagePromise;
              }
            }
          } catch (swError) {
            console.error('Error in service worker cleanup:', swError);
          }
        };
        
        // Don't await the service worker cleanup
        stopServiceWorker().finally(() => {
          console.log('Service worker cleanup completed');
        });
      }
      
      // Reset state immediately without waiting for service worker
      forceCleanup();
      
      console.log('Successfully stopped location sharing');
      
      toast({
        title: "Location Sharing Stopped",
        description: "Your live location is no longer being shared.",
        duration: 3000,
      });
      
    } catch (error) {
      console.error('Error in stopSharingLocation:', error);
      // Force cleanup even if there's an error
      forceCleanup();
      
      toast({
        title: "Location Sharing Stopped",
        description: "Your live location sharing has been stopped.",
        duration: 3000,
      });
    } finally {
      clearTimeout(stopTimeout);
    }
  };

  if (!isVerified && showOtpForm) {
    return (
      <div className="container mx-auto p-4 max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Verify Your Identity</CardTitle>
            <CardDescription>
              Enter the OTP sent to your WhatsApp to share your live location
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="otp">Enter OTP</Label>
                <Input
                  id="otp"
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="Enter 6-digit OTP"
                  maxLength={6}
                  className="mt-1"
                />
              </div>
              <Button 
                onClick={() => verifyOtp()} 
                disabled={isLoading} 
                className="w-full"
              >
                {isLoading ? 'Verifying...' : 'Verify OTP'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Share Live Location</CardTitle>
          <CardDescription>
            Your live location is being shared with the customer
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 border rounded-lg bg-gray-50">
              <p className="text-center font-medium">
                {location
                  ? `Location: ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`
                  : 'Waiting for location...'}
              </p>
            </div>
            
            <div className="flex space-x-4">
              <Button
                onClick={(e) => {
                  console.log('Start Sharing button clicked');
                  startSharingLocation().catch(error => {
                    console.error('Error in startSharingLocation:', error);
                    toast({
                      title: "Error",
                      description: error instanceof Error ? error.message : "Failed to start sharing location",
                      variant: "destructive"
                    });
                  });
                }}
                disabled={watchId.current !== null}
                className="flex-1"
                variant="outline"
              >
                Start Sharing
              </Button>
              <Button
                onClick={stopSharingLocation}
                disabled={watchId.current === null}
                className="flex-1"
                variant="destructive"
              >
                Stop Sharing
              </Button>
            </div>

            <div className="mt-4 text-sm text-gray-500">
              <p>• Your location will be updated every 10 seconds</p>
              <p>• Make sure to allow location access in your browser</p>
              <p>• Your location is only shared while this tab is open</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}