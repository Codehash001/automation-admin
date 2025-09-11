'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Pencil, Trash2, Phone, User, MapPin, CarTaxiFront } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

type RideServiceCategory = 'TRADITIONAL_TAXI' | 'LIMOUSINE';

interface VehicleType {
  id: number;
  category: RideServiceCategory;
  name: string;
  capacity: number;
  isActive: boolean;
}

interface Driver {
  id: number;
  name: string;
  phone: string;
  available: boolean;
  driverType: 'DELIVERY' | 'RIDE_SERVICE';
  rideServiceCategory: RideServiceCategory | null;
  rideVehicleType: string | null;
  rideVehicleCapacity: number | null;
  rideVehicleTypeRefId: number | null;
  emirates: { emirate: { id: number; name: string } }[];
  _count?: { deliveries?: number; }; // in case backend returns usage counts
  createdAt: string;
}

export default function PassengerDriversPage() {
  const { toast } = useToast();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [emirates, setEmirates] = useState<{ id: number; name: string }[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | RideServiceCategory>('ALL');
  const [availabilityFilter, setAvailabilityFilter] = useState<'ALL' | 'AVAILABLE' | 'UNAVAILABLE'>('ALL');
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);

  const [form, setForm] = useState<{
    name: string;
    phone: string;
    available: boolean;
    rideServiceCategory: RideServiceCategory | null;
    rideVehicleTypeRefId: number | undefined;
    rideVehicleType: string;
    rideVehicleCapacity: number | undefined;
    emirateIds: number[];
  }>({
    name: '',
    phone: '',
    available: true, // default true
    rideServiceCategory: null,
    rideVehicleTypeRefId: undefined,
    rideVehicleType: '',
    rideVehicleCapacity: undefined,
    emirateIds: [],
  });

  const loadAll = async () => {
    try {
      setLoading(true);
      const [driversRes, vehiclesRes, emiratesRes] = await Promise.all([
        fetch('/api/riders?driverType=RIDE_SERVICE'),
        fetch('/api/driver-service/vehicle-types'),
        fetch('/api/emirates'),
      ]);
      if (!driversRes.ok || !vehiclesRes.ok || !emiratesRes.ok) throw new Error('Failed to load data');

      const [driversData, vehiclesData, emiratesData] = await Promise.all([
        driversRes.json(),
        vehiclesRes.json(),
        emiratesRes.json(),
      ]);

      setDrivers(Array.isArray(driversData) ? driversData : []);
      setVehicleTypes(Array.isArray(vehiclesData) ? vehiclesData : []);
      setEmirates(Array.isArray(emiratesData) ? emiratesData : []);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to load', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const filtered = useMemo(() => {
    return drivers
      .filter(d => d.driverType === 'RIDE_SERVICE')
      .filter(d => categoryFilter === 'ALL' ? true : d.rideServiceCategory === categoryFilter)
      .filter(d => availabilityFilter === 'ALL' ? true : availabilityFilter === 'AVAILABLE' ? d.available : !d.available)
      .filter(d => {
        if (!search) return true;
        const s = search.toLowerCase();
        return (d.name || '').toLowerCase().includes(s)
          || (d.phone || '').toLowerCase().includes(s)
          || (d.rideVehicleType || '').toLowerCase().includes(s);
      });
  }, [drivers, categoryFilter, availabilityFilter, search]);

  const resetForm = () => {
    setForm({
      name: '',
      phone: '',
      available: true,
      rideServiceCategory: null,
      rideVehicleTypeRefId: undefined,
      rideVehicleType: '',
      rideVehicleCapacity: undefined,
      emirateIds: [],
    });
    setSelectedDriver(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (d: Driver) => {
    setSelectedDriver(d);
    setForm({
      name: d.name,
      phone: d.phone,
      available: d.available,
      rideServiceCategory: d.rideServiceCategory,
      rideVehicleTypeRefId: d.rideVehicleTypeRefId ?? undefined,
      rideVehicleType: d.rideVehicleType ?? '',
      rideVehicleCapacity: d.rideVehicleCapacity ?? undefined,
      emirateIds: d.emirates?.map(e => e.emirate.id) || [],
    });
    setDialogOpen(true);
  };

  const saveDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = selectedDriver ? 'PUT' : 'POST';
      const url = selectedDriver ? `/api/riders?id=${selectedDriver.id}` : '/api/riders';
      const payload = {
        name: form.name,
        phone: form.phone,
        available: form.available,
        driverType: 'RIDE_SERVICE',
        emirateIds: form.emirateIds,
        rideServiceCategory: form.rideServiceCategory,
        rideVehicleTypeRefId: form.rideVehicleTypeRefId,
        rideVehicleType: form.rideVehicleType || undefined,
        rideVehicleCapacity: form.rideVehicleCapacity,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to save driver');

      toast({ title: selectedDriver ? 'Driver updated' : 'Driver created' });
      setDialogOpen(false);
      resetForm();
      loadAll();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to save', variant: 'destructive' });
    }
  };

  const [candidateToDelete, setCandidateToDelete] = useState<Driver | null>(null);

  const askDelete = (d: Driver) => {
    setCandidateToDelete(d);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!candidateToDelete) return;
    try {
      // backend should block delete if driver is in use
      const res = await fetch(`/api/riders?id=${candidateToDelete.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to delete driver');
      toast({ title: 'Driver deleted' });
      setDeleteOpen(false);
      setCandidateToDelete(null);
      loadAll();
    } catch (e: any) {
      toast({ title: 'Cannot delete', description: e.message || 'Driver is in use', variant: 'destructive' });
      setDeleteOpen(false);
      setCandidateToDelete(null);
    }
  };

  const onVehiclePicked = (id: number) => {
    const vt = vehicleTypes.find(v => v.id === id);
    setForm(prev => ({
      ...prev,
      rideVehicleTypeRefId: id,
      rideVehicleType: vt?.name || '',
      rideVehicleCapacity: vt?.capacity,
      rideServiceCategory: vt?.category ?? prev.rideServiceCategory,
    }));
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Passenger Drivers</h1>
          <p className="text-muted-foreground">
            Manage ride-service drivers (Taxi & Limousine)
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Driver</Button>
          <Button variant="outline" onClick={loadAll}>Refresh</Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Category</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as any)}
            className="border rounded px-2 py-1"
          >
            <option value="ALL">All</option>
            <option value="TRADITIONAL_TAXI">Traditional Taxi</option>
            <option value="LIMOUSINE">Limousine</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Availability</label>
          <select
            value={availabilityFilter}
            onChange={(e) => setAvailabilityFilter(e.target.value as any)}
            className="border rounded px-2 py-1"
          >
            <option value="ALL">All</option>
            <option value="AVAILABLE">Available</option>
            <option value="UNAVAILABLE">Unavailable</option>
          </select>
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone, or vehicle type"
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Driver</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Vehicle Type</TableHead>
              <TableHead>Capacity</TableHead>
              <TableHead>Availability</TableHead>
              <TableHead>Emirates</TableHead>
              <TableHead>Member Since</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={9}>Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={9}>No drivers found</TableCell></TableRow>
            ) : filtered.map(d => (
              <TableRow key={d.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <span>{d.name}</span>
                  </div>
                </TableCell>
                <TableCell>{d.phone}</TableCell>
                <TableCell>{d.rideServiceCategory === 'TRADITIONAL_TAXI' ? 'Traditional Taxi' : d.rideServiceCategory === 'LIMOUSINE' ? 'Limousine' : '—'}</TableCell>
                <TableCell>{d.rideVehicleType || '—'}</TableCell>
                <TableCell>{d.rideVehicleCapacity ?? '—'}</TableCell>
                <TableCell>
                  <div className="flex items-center">
                    <div className={`h-2 w-2 rounded-full mr-2 ${d.available ? 'bg-green-500' : 'bg-gray-400'}`} />
                    {d.available ? 'Available' : 'Unavailable'}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1 max-w-xs">
                    {d.emirates?.map(e => (
                      <span key={e.emirate.id} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        <MapPin className="h-3 w-3 mr-1" />
                        {e.emirate.name}
                      </span>
                    ))}
                  </div>
                </TableCell>
                <TableCell>{new Date(d.createdAt).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(d)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => askDelete(d)}
                      disabled={(d._count?.deliveries ?? 0) > 0}
                      title={(d._count?.deliveries ?? 0) > 0 ? 'Cannot delete a driver linked to records' : 'Delete'}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{selectedDriver ? 'Edit Driver' : 'Add Driver'}</DialogTitle></DialogHeader>
          <form onSubmit={saveDriver} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-10"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Availability</Label>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={form.available}
                    onCheckedChange={(c) => setForm(f => ({ ...f, available: Boolean(c) }))}
                  />
                  <span>Available for service</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="category"
                      value="TRADITIONAL_TAXI"
                      checked={form.rideServiceCategory === 'TRADITIONAL_TAXI'}
                      onChange={() => setForm(f => ({ ...f, rideServiceCategory: 'TRADITIONAL_TAXI', rideVehicleTypeRefId: undefined, rideVehicleType: '', rideVehicleCapacity: undefined }))}
                    />
                    Traditional Taxi
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="category"
                      value="LIMOUSINE"
                      checked={form.rideServiceCategory === 'LIMOUSINE'}
                      onChange={() => setForm(f => ({ ...f, rideServiceCategory: 'LIMOUSINE', rideVehicleTypeRefId: undefined, rideVehicleType: '', rideVehicleCapacity: undefined }))}
                    />
                    Limousine
                  </label>
                </div>
              </div>

              {form.rideServiceCategory && (
                <div className="space-y-2 md:col-span-2">
                  <Label>Vehicle Type</Label>
                  <div className="grid gap-2">
                    {vehicleTypes.filter(v => v.isActive && v.category === form.rideServiceCategory).map(v => (
                      <label key={v.id} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="vehicleType"
                          value={v.id}
                          checked={form.rideVehicleTypeRefId === v.id}
                          onChange={() => onVehiclePicked(v.id)}
                        />
                        {v.name} – {v.capacity} people
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2 md:col-span-2">
                <Label>Service Areas</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {emirates.map(e => (
                    <label key={e.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={form.emirateIds.includes(e.id)}
                        onCheckedChange={() =>
                          setForm(f => ({
                            ...f,
                            emirateIds: f.emirateIds.includes(e.id)
                              ? f.emirateIds.filter(x => x !== e.id)
                              : [...f.emirateIds, e.id],
                          }))
                        }
                      />
                      {e.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
                Cancel
              </Button>
              <Button type="submit">{selectedDriver ? 'Update' : 'Create'} Driver</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Driver?</AlertDialogTitle>
            <AlertDialogDescription>
              Deleting a driver is blocked if the driver has linked records. If allowed, this action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}