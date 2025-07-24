// app/dashboard/deliveries/live/[deliveryId]/page.tsx
'use client';

import { useEffect, useState } from 'react';
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
  const [watchId, setWatchId] = useState<number | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState('');
  const [serviceWorkerRegistered, setServiceWorkerRegistered] = useState(false);
  

  

  const sendLocationToServer = async (latitude: number, longitude: number) => {
    try {
      // Get the rider's phone number from the URL or session
      const searchParams = new URLSearchParams(window.location.search);
      const phone = searchParams.get('phone');
      
      if (!phone) {
        throw new Error('Phone number is required for location updates');
      }

      const response = await fetch('/api/deliveries', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
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

      if (data.deliveryId !== params.deliveryId) {
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

  const startSharingLocation = async () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    setIsSharing(true);
    setError('');

    try {
      // First, get the current position immediately
      const initialPosition = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });
      
      const { latitude, longitude } = initialPosition.coords;
      setLocation({ lat: latitude, lng: longitude });
      
      // Send initial location to server
      await sendLocationToServer(latitude, longitude);
      
      // Start background location tracking using service worker
      if (serviceWorkerRegistered && 'serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.ready;
          if (registration.active) {
            const channel = new MessageChannel();
            
            channel.port1.onmessage = (event) => {
              if (event.data.status === 'TRACKING_STARTED') {
                console.log('Background location tracking started');
              } else if (event.data.status === 'TRACKING_STOPPED') {
                console.log('Background location tracking stopped');
              }
            };
            
            registration.active.postMessage({
              type: 'START_LOCATION_TRACKING',
              deliveryId: parseInt(params.deliveryId),
              interval: 10000 // 10 seconds
            }, [channel.port2]);
          }
        } catch (swError) {
          console.error('Service Worker Error:', swError);
          // Fallback to regular geolocation if service worker fails
          startRegularGeolocationWatch();
        }
      } else {
        // Fallback to regular geolocation if service workers are not supported
        startRegularGeolocationWatch();
      }
    } catch (error) {
      console.error('Error initializing location sharing:', error);
      toast({
        title: "Error",
        description: "Failed to start location sharing. Please try again.",
        variant: "destructive",
      });
    }
    toast({
      title: "Success",
      description: "Started sharing your live location",
    });
  };

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
    setWatchId(id);
  };

  const stopSharingLocation = async () => {
    // Stop any active geolocation watch
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    
    // Stop service worker tracking if active
    if (serviceWorkerRegistered && 'serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        if (registration.active) {
          registration.active.postMessage({
            type: 'STOP_LOCATION_TRACKING'
          });
        }
      } catch (error) {
        console.error('Error stopping service worker tracking:', error);
      }
    }
    
    setLocation(null);
    setIsSharing(false);
    toast({
      title: "Info",
      description: "Stopped sharing your live location",
    });
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
                onClick={startSharingLocation}
                disabled={watchId !== null}
                className="flex-1"
                variant="outline"
              >
                Start Sharing
              </Button>
              <Button
                onClick={stopSharingLocation}
                disabled={watchId === null}
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