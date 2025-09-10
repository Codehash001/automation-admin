'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';

export default function RideLiveSharePage() {
  const params = useParams();
  const rideRequestId = Number(params?.rideRequestId);

  const [otp, setOtp] = useState<string>('');
  const [genLoading, setGenLoading] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [status, setStatus] = useState<string>('');
  const watchIdRef = useRef<number | null>(null);

  const generateOtp = async () => {
    try {
      setGenLoading(true);
      const res = await fetch('/api/driver-service/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rideRequestId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed');
      setOtp(data.otp);
      setStatus('OTP generated. Share this with the customer.');
    } catch (e: any) {
      setStatus(e.message || 'Failed to generate OTP');
    } finally {
      setGenLoading(false);
    }
  };

  const startSharing = async () => {
    if (!('geolocation' in navigator)) {
      setStatus('Geolocation is not supported in this browser');
      return;
    }
    setShareLoading(true);

    const onPos = async (pos: GeolocationPosition) => {
      const latitude = pos.coords.latitude;
      const longitude = pos.coords.longitude;
      try {
        await fetch('/api/driver-service', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: rideRequestId, liveLocation: { latitude, longitude } }),
        });
        setStatus(`Live location updated: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
      } catch (e) {
        // swallow errors to keep sharing running
      }
    };

    const onErr = (err: GeolocationPositionError) => {
      setStatus(`Geolocation error: ${err.message}`);
    };

    const id = navigator.geolocation.watchPosition(onPos, onErr, {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 20000,
    });
    watchIdRef.current = id as unknown as number;
  };

  const stopSharing = () => {
    if (watchIdRef.current !== null && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      setStatus('Stopped location sharing');
    }
  };

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  if (!rideRequestId) return <div className="p-6">Invalid ride request</div>;

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Ride Live Sharing</h1>
      <p className="text-sm text-gray-500">Ride Request ID: {rideRequestId}</p>

      <div className="space-y-2 border p-4 rounded-md">
        <h2 className="font-semibold">Step 1: Generate OTP</h2>
        <button onClick={generateOtp} disabled={genLoading} className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50">
          {genLoading ? 'Generating...' : 'Generate OTP for Customer'}
        </button>
        {otp && (
          <div className="mt-2">
            <span className="font-semibold">OTP: </span>
            <span className="text-lg tracking-widest">{otp}</span>
            <p className="text-xs text-gray-500">Valid for 120 minutes</p>
          </div>
        )}
      </div>

      <div className="space-y-2 border p-4 rounded-md">
        <h2 className="font-semibold">Step 2: Share Live Location</h2>
        <div className="flex gap-2">
          <button onClick={startSharing} disabled={shareLoading} className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50">
            {shareLoading ? 'Starting...' : 'Start Sharing'}
          </button>
          <button onClick={stopSharing} className="px-4 py-2 bg-gray-200 rounded">
            Stop
          </button>
        </div>
        {status && <p className="text-sm text-gray-600">{status}</p>}
      </div>
    </div>
  );
}
