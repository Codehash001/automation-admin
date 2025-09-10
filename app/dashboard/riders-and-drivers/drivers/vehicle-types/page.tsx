'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
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
  createdAt: string;
}

export default function VehicleTypesPage() {
  const { toast } = useToast();
  const [types, setTypes] = useState<VehicleType[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | RideServiceCategory>('ALL');
  const [search, setSearch] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<VehicleType | null>(null);

  const [form, setForm] = useState<{
    category: RideServiceCategory | 'TRADITIONAL_TAXI';
    name: string;
    capacity: number | '';
    isActive: boolean;
  }>({
    category: 'TRADITIONAL_TAXI',
    name: '',
    capacity: '',
    isActive: true,
  });

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/driver-service/vehicle-types');
      if (!res.ok) throw new Error('Failed to load vehicle types');
      const data = await res.json();
      setTypes(Array.isArray(data) ? data : []);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to load', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return types
      .filter(t => categoryFilter === 'ALL' ? true : t.category === categoryFilter)
      .filter(t => {
        if (!search) return true;
        const s = search.toLowerCase();
        return t.name.toLowerCase().includes(s);
      });
  }, [types, categoryFilter, search]);

  const resetForm = () => {
    setSelected(null);
    setForm({ category: 'TRADITIONAL_TAXI', name: '', capacity: '', isActive: true });
  };

  const openCreate = () => { resetForm(); setDialogOpen(true); };
  const openEdit = (t: VehicleType) => {
    setSelected(t);
    setForm({ category: t.category, name: t.name, capacity: t.capacity, isActive: t.isActive });
    setDialogOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        category: form.category,
        name: form.name,
        capacity: Number(form.capacity) || 0,
        isActive: form.isActive,
      };
      const method = selected ? 'PUT' : 'POST';
      const url = selected ? `/api/driver-service/vehicle-types?id=${selected.id}` : '/api/driver-service/vehicle-types';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to save vehicle type');

      toast({ title: selected ? 'Vehicle type updated' : 'Vehicle type created' });
      setDialogOpen(false);
      resetForm();
      load();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to save', variant: 'destructive' });
    }
  };

  const [candidate, setCandidate] = useState<VehicleType | null>(null);
  const askDelete = (t: VehicleType) => { setCandidate(t); setDeleteOpen(true); };

  const confirmDelete = async () => {
    if (!candidate) return;
    try {
      const res = await fetch(`/api/driver-service/vehicle-types?id=${candidate.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Vehicle type is in use or cannot be deleted');
      toast({ title: 'Vehicle type deleted' });
      setDeleteOpen(false);
      setCandidate(null);
      load();
    } catch (e: any) {
      toast({ title: 'Cannot delete', description: e.message || 'Vehicle type is in use', variant: 'destructive' });
      setDeleteOpen(false);
      setCandidate(null);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Vehicle Types</h1>
          <p className="text-muted-foreground">Manage exact vehicle types for passenger drivers</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Vehicle Type</Button>
          <Button variant="outline" onClick={load}>Refresh</Button>
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
        <div className="relative flex-1">
          <Input
            placeholder="Search by vehicle type name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Capacity</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6}>Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>No vehicle types found</TableCell>
              </TableRow>
            ) : filtered.map(t => (
              <TableRow key={t.id}>
                <TableCell>{t.name}</TableCell>
                <TableCell>{t.category === 'TRADITIONAL_TAXI' ? 'Traditional Taxi' : 'Limousine'}</TableCell>
                <TableCell>{t.capacity}</TableCell>
                <TableCell>{t.isActive ? 'Yes' : 'No'}</TableCell>
                <TableCell>{new Date(t.createdAt).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => askDelete(t)}>
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
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{selected ? 'Edit Vehicle Type' : 'Add Vehicle Type'}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="category"
                    value="TRADITIONAL_TAXI"
                    checked={form.category === 'TRADITIONAL_TAXI'}
                    onChange={() => setForm(f => ({ ...f, category: 'TRADITIONAL_TAXI' }))}
                  />
                  Traditional Taxi
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="category"
                    value="LIMOUSINE"
                    checked={form.category === 'LIMOUSINE'}
                    onChange={() => setForm(f => ({ ...f, category: 'LIMOUSINE' }))}
                  />
                  Limousine
                </label>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label>Capacity</Label>
              <Input
                type="number"
                min={1}
                value={form.capacity}
                onChange={(e) => setForm(f => ({ ...f, capacity: e.target.value === '' ? '' : Number(e.target.value) }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Active</Label>
              <div className="flex items-center gap-2">
                <Checkbox checked={form.isActive} onCheckedChange={(c) => setForm(f => ({ ...f, isActive: Boolean(c) }))} />
                <span>Active</span>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
                Cancel
              </Button>
              <Button type="submit">{selected ? 'Update' : 'Create'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Vehicle Type?</AlertDialogTitle>
            <AlertDialogDescription>
              Deleting is blocked if the type is in use (by drivers or ride requests). If allowed, this cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}