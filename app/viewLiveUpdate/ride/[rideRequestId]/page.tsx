'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

export default function RideLiveViewPage() {
  const params = useParams();
  const rideRequestId = Number(params?.rideRequestId);

  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [driverName, setDriverName] = useState<string>('');
  const [driverPhone, setDriverPhone] = useState<string>('');
  const [liveLocation, setLiveLocation] = useState<string | null>(null);
  const [pickupLocation, setPickupLocation] = useState<string | null>(null);
  const [dropoffLocation, setDropoffLocation] = useState<string | null>(null);

  // Poll driver live location after verified
  useEffect(() => {
    if (!verified) return;

    let interval: any = null;
    const poll = async () => {
      try {
        const res = await fetch(`/api/driver-service?id=${rideRequestId}`);
        const data = await res.json();
        if (res.ok && data?.driver) {
          setLiveLocation(data.driver.liveLocation ?? null);
          setDriverName(data.driver.name ?? '');
          setDriverPhone(data.driver.phone ?? '');
          setPickupLocation(data.pickupLocation ?? null);
          setDropoffLocation(data.dropoffLocation ?? null);
        }
      } catch {}
    };

    poll();
    interval = setInterval(poll, 5000);
    return () => interval && clearInterval(interval);
  }, [verified, rideRequestId]);

  const verifyOtp = async () => {
    try {
      setVerifying(true);
      setError(null);
      const res = await fetch('/api/driver-service/otp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Invalid OTP');
      setVerified(true);
      setDriverName(data.ride?.driver?.name ?? '');
      setDriverPhone(data.ride?.driver?.phone ?? '');
      setLiveLocation(data.ride?.driver?.liveLocation ?? null);
      setPickupLocation(data.ride?.pickupLocation ?? null);
      setDropoffLocation(data.ride?.dropoffLocation ?? null);
    } catch (e: any) {
      setError(e.message || 'Failed to verify OTP');
    } finally {
      setVerifying(false);
    }
  };

  const renderMapLink = (label: string, coords?: string | null) => {
    if (!coords) return null;
    const [lat, lng] = (coords || '').split(',').map(s => s.trim());
    const href = `https://www.google.com/maps?q=${lat},${lng}`;
    return (
      <a href={href} target="_blank" className="text-blue-600 underline">
        {label}: {lat}, {lng}
      </a>
    );
  };

  if (!rideRequestId) return <div className="p-6">Invalid ride request</div>;

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Track Your Ride</h1>
      {!verified ? (
        <div className="space-y-3 border p-4 rounded-md">
          <p className="text-sm text-gray-600">Enter the 6-digit OTP shared by your driver.</p>
          <input
            type="text"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            className="border rounded px-3 py-2 w-full"
            placeholder="Enter OTP"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button onClick={verifyOtp} disabled={verifying} className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50">
            {verifying ? 'Verifying...' : 'Verify OTP'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="border p-4 rounded-md space-y-1">
            <h2 className="font-semibold">Driver</h2>
            <p>Name: {driverName || 'N/A'}</p>
            <p>Phone: {driverPhone || 'N/A'}</p>
            {renderMapLink('Driver Live Location', liveLocation)}
          </div>
          <div className="border p-4 rounded-md space-y-1">
            <h2 className="font-semibold">Route</h2>
            {renderMapLink('Pickup', pickupLocation)}
            {renderMapLink('Dropoff', dropoffLocation)}
          </div>
          <p className="text-xs text-gray-500">Location auto-refreshes every 5 seconds.</p>
        </div>
      )}
    </div>
  );
}
