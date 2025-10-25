'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Loader2, MapPin, Navigation, CheckCircle, XCircle, Clock } from 'lucide-react';

// Map (client-only) - reuse the dynamic import pattern from delivery page
const MapWithNoSSR = dynamic(() => import('@/components/map'), { ssr: false });

interface Location { lat: number; lng: number; address?: string; }
interface Driver { id: number; name: string; phone: string; liveLocation: string | null; }
interface RideDetails {
  id: number;
  status: string;
  driver: Driver | null;
  pickupLocation: string | null;
  dropoffLocation: string | null;
  createdAt?: string;
  updatedAt?: string;
}

const pageStyle = { height: '100%', width: '100%', display: 'flex', flexDirection: 'column' as const, overflow: 'hidden', position: 'relative' as const };

export default function RideLiveSharePage({ params }: { params: { rideRequestId: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [rideDetails, setRideDetails] = useState<RideDetails | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [pickupLocation, setPickupLocation] = useState<Location | null>(null);
  const [dropoffLocation, setDropoffLocation] = useState<Location | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ coordinates: Array<[number, number]>; distance: number; duration: number }>({ coordinates: [], distance: 0, duration: 0 });
  const watchIdRef = useRef<number | null>(null);

  const parseLocation = (input: any): Location | null => {
    if (!input) return null;
    if (typeof input === 'string' && input.includes(',')) {
      const [lat, lng] = input.split(',').map((n: string) => parseFloat(n.trim()));
      if (!isNaN(lat) && !isNaN(lng)) return { lat, lng } as Location;
    }
    if (typeof input === 'object' && 'lat' in input && 'lng' in input) {
      return { lat: parseFloat((input as any).lat), lng: parseFloat((input as any).lng) };
    }
    return null;
  };

  // Load cached data and fetch fresh ride
  useEffect(() => {
    const saved = localStorage.getItem(`rideDetails_${params.rideRequestId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setRideDetails(parsed);
        if (parsed.pickupLocation) setPickupLocation(parseLocation(parsed.pickupLocation));
        if (parsed.dropoffLocation) setDropoffLocation(parseLocation(parsed.dropoffLocation));
      } catch {}
    }
    fetchRideDetails().catch(console.error);
  }, [params.rideRequestId]);

  const fetchRideDetails = useCallback(async () => {
    const res = await fetch(`/api/driver-service?id=${params.rideRequestId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_API_KEY}`,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast({ title: 'Error', description: err.error || 'Failed to fetch ride details', variant: 'destructive' });
      return;
    }
    const data: RideDetails = await res.json();
    setRideDetails(data);
    localStorage.setItem(`rideDetails_${params.rideRequestId}`, JSON.stringify(data));
    if (data.driver?.liveLocation) {
      const [lat, lng] = data.driver.liveLocation.split(',').map(Number);
      if (!isNaN(lat) && !isNaN(lng)) setCurrentLocation({ lat, lng });
    }
    if (data.pickupLocation) setPickupLocation(parseLocation(data.pickupLocation));
    if (data.dropoffLocation) setDropoffLocation(parseLocation(data.dropoffLocation));
    return data;
  }, [params.rideRequestId]);

  // OTP: check URL and localStorage
  useEffect(() => {
    const checkStored = async () => {
      const stored = localStorage.getItem(`ride_otp_${params.rideRequestId}`);
      if (stored) {
        const { otp, timestamp } = JSON.parse(stored);
        if (Date.now() - timestamp < 2 * 60 * 60 * 1000) { // 2 hours
          setOtp(otp);
          await verifyOtp(otp);
          return true;
        } else {
          localStorage.removeItem(`ride_otp_${params.rideRequestId}`);
        }
      }
      return false;
    };
    const otpParam = searchParams.get('otp');
    if (otpParam) {
      setOtp(otpParam);
      verifyOtp(otpParam);
    } else {
      checkStored();
    }
  }, [searchParams, params.rideRequestId]);

  const storeOtp = (value: string) => {
    localStorage.setItem(`ride_otp_${params.rideRequestId}`, JSON.stringify({ otp: value, timestamp: Date.now() }));
  };

  const verifyOtp = async (otpToVerify: string) => {
    try {
      setIsLoading(true);
      // Use same OTP endpoint as delivery (shared OTP)
      const response = await fetch(`/api/driver-service/otp`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_API_KEY}` },
        body: JSON.stringify({ otp: otpToVerify }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to verify OTP');
      setIsVerified(true);
      storeOtp(otpToVerify);
      await fetchRideDetails();
      toast({ title: 'OTP Verified', description: 'Ride details loaded.' });
      startLocationTracking();
    } catch (e: any) {
      toast({ title: 'Verification Failed', description: e.message || 'Invalid OTP', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  // Geolocation and server sync
  const sendLocationToServer = async (lat: number, lng: number) => {
    try {
      const response = await fetch('/api/driver-service', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_API_KEY}` },
        body: JSON.stringify({ id: Number(params.rideRequestId), liveLocation: { latitude: lat, longitude: lng } }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update location');
      }
    } catch (e) {
      console.error('Ride location update failed:', e);
    }
  };

  const getDistance = (a: Location, b: Location) => {
    const R = 6371e3;
    const φ1 = a.lat * Math.PI / 180; const φ2 = b.lat * Math.PI / 180;
    const dφ = (b.lat - a.lat) * Math.PI / 180; const dλ = (b.lng - a.lng) * Math.PI / 180;
    const s = Math.sin(dφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(dλ/2)**2;
    return 2 * R * Math.atan2(Math.sqrt(s), Math.sqrt(1-s));
  };

  const updateRideStatus = async (status: 'PICKING_UP' | 'IN_PROGRESS' | 'COMPLETED') => {
    try {
      const res = await fetch('/api/driver-service/status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rideRequestId: Number(params.rideRequestId), status }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to update ride status');
      setRideDetails(prev => prev ? { ...prev, status: data.ride.status } : prev);
    } catch (e) {
      console.error('Ride status update failed:', e);
    }
  };

  const startLocationTracking = useCallback(() => {
    if (!navigator.geolocation) {
      toast({ title: 'Location Error', description: 'Geolocation is not supported', variant: 'destructive' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCurrentLocation(loc);
        sendLocationToServer(loc.lat, loc.lng);
        const id = navigator.geolocation.watchPosition(
          (p) => {
            const { latitude, longitude } = p.coords;
            const newLoc = { lat: latitude, lng: longitude };
            setCurrentLocation(newLoc);
            // proximity-based status changes
            if (pickupLocation && rideDetails?.status === 'PICKING_UP') {
              if (getDistance(newLoc, pickupLocation) < 50) updateRideStatus('IN_PROGRESS');
            }
            if (dropoffLocation && rideDetails?.status === 'IN_PROGRESS') {
              if (getDistance(newLoc, dropoffLocation) < 30) updateRideStatus('COMPLETED');
            }
            sendLocationToServer(latitude, longitude);
          },
          (err) => {
            console.error('Geo watch error:', err);
          },
          { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
        );
        watchIdRef.current = id as unknown as number;
      },
      (err) => {
        console.error('Geo initial error:', err);
        toast({ title: 'Location Error', description: 'Could not get your current location', variant: 'destructive' });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [pickupLocation, dropoffLocation, rideDetails?.status]);

  useEffect(() => () => { if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current); }, []);

  // OTP Screen
  if (!isVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">Verify Your Identity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Input type="text" placeholder="Enter OTP" value={otp} onChange={(e) => setOtp(e.target.value)} className="text-center text-lg font-mono tracking-widest" maxLength={6} disabled={isLoading} />
              </div>
              <Button onClick={() => verifyOtp(otp)} disabled={isLoading || !otp} className="w-full">
                {isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...</>) : ('Verify OTP')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Map View - visually similar to delivery page (full-screen map component)
  return (
    <div style={pageStyle} className="bg-white">
      <div className="flex-1 relative">
        <MapWithNoSSR
          currentLocation={currentLocation}
          pickupLocation={pickupLocation}
          dropoffLocation={dropoffLocation}
          onRouteUpdate={(r: any) => setRouteInfo(r)}
        />
        {/* Route Info Overlay */}
        {routeInfo?.distance > 0 && (
          <div className="absolute bottom-4 left-2 right-2 md:left-4 md:right-auto bg-white p-2 md:p-3 rounded-lg shadow-md z-10 max-w-md mx-auto md:mx-0">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium">{(routeInfo.distance / 1000).toFixed(1)} km</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium">{Math.round(routeInfo.duration / 60)} min</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
