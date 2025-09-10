'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Ride {
  id: number;
  status: string;
  customerPhone: string | null;
  pickupLocation: string | null;
  dropoffLocation: string | null;
  requestedVehicleType?: { id: number; name: string; capacity: number; category: string } | null;
  driver?: { id: number; name: string; phone: string } | null;
  createdAt: string;
}

const STATUS_OPTIONS = [
  'ALL',
  'PENDING',
  'PICKING_UP',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_RIDERS_AVAILABLE',
];

export default function PassengerRidesPage() {
  const router = useRouter();
  const [rides, setRides] = useState<Ride[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const fetchRides = async () => {
    try {
      setIsLoading(true);
      const url = statusFilter !== 'ALL' ? `/api/driver-service?status=${statusFilter}` : '/api/driver-service';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch rides');
      const data = await res.json();
      setRides(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRides();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const filtered = rides.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (r.customerPhone || '').toLowerCase().includes(s) ||
      (r.driver?.name || '').toLowerCase().includes(s) ||
      (r.driver?.phone || '').toLowerCase().includes(s) ||
      (r.requestedVehicleType?.name || '').toLowerCase().includes(s)
    );
  });

  const formatDate = (iso?: string) => {
    if (!iso) return 'N/A';
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  const mapLink = (coords?: string | null) => {
    if (!coords) return null;
    const [lat, lng] = coords.split(',').map((x) => x.trim());
    if (!lat || !lng) return null;
    return (
      <a
        href={`https://www.google.com/maps?q=${lat},${lng}`}
        target="_blank"
        className="text-blue-600 underline"
      >
        {lat}, {lng}
      </a>
    );
  };

  const statusBadge = (status: string) => {
    const color: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      PICKING_UP: 'bg-blue-100 text-blue-800',
      IN_PROGRESS: 'bg-indigo-100 text-indigo-800',
      COMPLETED: 'bg-green-100 text-green-800',
      CANCELLED: 'bg-red-100 text-red-800',
      NO_RIDERS_AVAILABLE: 'bg-gray-100 text-gray-800',
    };
    return <Badge className={color[status] || 'bg-gray-100 text-gray-800'}>{status}</Badge>;
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Passenger Rides</h1>
          <p className="text-muted-foreground">Manage human rides (Taxi/Limo)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchRides}>Refresh</Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded px-2 py-1"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 flex items-center gap-2">
          <Input
            placeholder="Search by customer phone, driver, or vehicle type"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="border rounded-md overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Requested Vehicle</TableHead>
              <TableHead>Pickup</TableHead>
              <TableHead>Dropoff</TableHead>
              <TableHead>Driver</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8}>Loading...</TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>No rides found</TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono">{r.id}</TableCell>
                  <TableCell>{statusBadge(r.status)}</TableCell>
                  <TableCell>
                    {r.requestedVehicleType ? (
                      <div className="flex flex-col">
                        <span className="font-medium">{r.requestedVehicleType.name}</span>
                        <span className="text-xs text-muted-foreground">{r.requestedVehicleType.capacity} people</span>
                      </div>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>{mapLink(r.pickupLocation) || '—'}</TableCell>
                  <TableCell>{mapLink(r.dropoffLocation) || '—'}</TableCell>
                  <TableCell>
                    {r.driver ? (
                      <div className="flex flex-col">
                        <span className="font-medium">{r.driver.name}</span>
                        <span className="text-xs text-muted-foreground">{r.driver.phone}</span>
                      </div>
                    ) : 'Unassigned'}
                  </TableCell>
                  <TableCell>{r.customerPhone || '—'}</TableCell>
                  <TableCell>{formatDate(r.createdAt)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
