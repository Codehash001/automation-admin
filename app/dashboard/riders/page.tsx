'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Pencil, Trash2, Phone, User, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface Rider {
  id: number;
  name: string;
  phone: string;
  available: boolean;
  driverType: 'DELIVERY' | 'RIDE_SERVICE';
  rideServiceCategory?: 'TRADITIONAL_TAXI' | 'LIMOUSINE' | null;
  rideVehicleType?: string | null;
  rideVehicleCapacity?: number | null;
  emirates: {
    emirate: {
      id: number;
      name: string;
    };
  }[];
  _count: {
    deliveries: number;
  };
  createdAt: string;
}

export default function RidersPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [riders, setRiders] = useState<Rider[]>([]);
  const [emirates, setEmirates] = useState<{id: number; name: string}[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedRider, setSelectedRider] = useState<Rider | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    available: true,
    driverType: 'DELIVERY' as 'DELIVERY' | 'RIDE_SERVICE',
    emirateIds: [] as number[],
    rideServiceCategory: null as null | 'TRADITIONAL_TAXI' | 'LIMOUSINE',
    rideVehicleType: '' as string,
    rideVehicleCapacity: undefined as number | undefined,
  });

  // Ride service vehicle options
  const TAXI_TYPES: { label: string; value: string; capacity: number }[] = [
    { label: 'Sedan – 4 people', value: 'Sedan', capacity: 4 },
    { label: 'SUV – 6 people', value: 'SUV', capacity: 6 },
    { label: 'Van – 8 people', value: 'Van', capacity: 8 },
    { label: 'Mini Bus – 12 people', value: 'Mini Bus', capacity: 12 },
  ];
  // Example limo types (can be extended later)
  const LIMO_TYPES: { label: string; value: string; capacity: number }[] = [
    { label: 'Standard Limo – 6 people', value: 'Standard Limo', capacity: 6 },
    { label: 'Stretch Limo – 10 people', value: 'Stretch Limo', capacity: 10 },
  ];

  // Fetch riders and emirates
  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [ridersRes, emiratesRes] = await Promise.all([
        fetch('/api/riders'),
        fetch('/api/emirates'),
      ]);

      if (!ridersRes.ok || !emiratesRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const ridersData = await ridersRes.json();
      const emiratesData = await emiratesRes.json();

      setRiders(ridersData);
      setEmirates(emiratesData);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load data. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter riders based on search term
  const filteredRiders = riders.filter(
    (rider) =>
      rider.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rider.phone.includes(searchTerm)
  );

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  // Handle emirate selection
  const handleEmirateChange = (emirateId: number) => {
    setFormData((prev) => {
      const emirateIds = prev.emirateIds.includes(emirateId)
        ? prev.emirateIds.filter((id) => id !== emirateId)
        : [...prev.emirateIds, emirateId];
      
      return {
        ...prev,
        emirateIds,
      };
    });
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = selectedRider ? 'PUT' : 'POST';
      const url = selectedRider
        ? `/api/riders?id=${selectedRider.id}`
        : '/api/riders';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          // Normalize ride fields: only send when RIDE_SERVICE
          ...(formData.driverType === 'RIDE_SERVICE'
            ? {
                rideServiceCategory: formData.rideServiceCategory,
                rideVehicleType: formData.rideVehicleType || undefined,
                rideVehicleCapacity: formData.rideVehicleCapacity,
              }
            : {
                rideServiceCategory: null,
                rideVehicleType: null,
                rideVehicleCapacity: null,
              }),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save rider');
      }

      toast({
        title: selectedRider ? 'Rider Updated' : 'Rider Created',
        description: selectedRider 
          ? 'Rider details have been updated successfully.'
          : 'New rider has been added successfully.',
      });

      // Reset form and refetch riders
      setFormData({ 
        name: '', 
        phone: '', 
        available: true, 
        driverType: 'DELIVERY',
        emirateIds: [],
        rideServiceCategory: null,
        rideVehicleType: '',
        rideVehicleCapacity: undefined,
      });
      setSelectedRider(null);
      setIsDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving rider:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save rider',
        variant: 'destructive',
      });
    }
  };

  // Handle edit rider
  const handleEdit = (rider: Rider) => {
    setSelectedRider(rider);
    setFormData({
      name: rider.name,
      phone: rider.phone,
      available: rider.available,
      driverType: rider.driverType,
      emirateIds: rider.emirates.map(e => e.emirate.id),
      rideServiceCategory: rider.rideServiceCategory ?? null,
      rideVehicleType: rider.rideVehicleType ?? '',
      rideVehicleCapacity: rider.rideVehicleCapacity ?? undefined,
    });
    setIsDialogOpen(true);
  };

  // Handle delete rider
  const handleDelete = async () => {
    if (!selectedRider) return;

    try {
      const response = await fetch(`/api/riders?id=${selectedRider.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete rider');
      }

      toast({
        title: 'Rider Deleted',
        description: 'The rider has been removed successfully.',
      });

      // Reset and refetch
      setSelectedRider(null);
      setIsDeleteDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error deleting rider:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete rider',
        variant: 'destructive',
      });
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    
    try {
      const date = new Date(dateString);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid date string:', dateString);
        return 'N/A';
      }
      
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch (error) {
      console.error('Error formatting date:', error, 'Date string:', dateString);
      return 'N/A';
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Riders</h1>
            <p className="text-muted-foreground">
              Manage your riders and their information
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setSelectedRider(null)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Rider
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {selectedRider ? 'Edit Rider' : 'Add New Rider'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      placeholder="John Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="phone"
                        name="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={handleInputChange}
                        required
                        placeholder="+1234567890"
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Driver Type</Label>
                    <div className="flex space-x-4">
                      <label className="flex items-center space-x-2">
                        <input
                          type="radio"
                          name="driverType"
                          value="DELIVERY"
                          checked={formData.driverType === 'DELIVERY'}
                          onChange={() => setFormData(prev => ({ 
                            ...prev, 
                            driverType: 'DELIVERY',
                            // clear ride-specific fields when switching away
                            rideServiceCategory: null,
                            rideVehicleType: '',
                            rideVehicleCapacity: undefined,
                          }))}
                          className="h-4 w-4 text-primary"
                        />
                        <span>Delivery Rider</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="radio"
                          name="driverType"
                          value="RIDE_SERVICE"
                          checked={formData.driverType === 'RIDE_SERVICE'}
                          onChange={() => setFormData(prev => ({ ...prev, driverType: 'RIDE_SERVICE' }))}
                          className="h-4 w-4 text-primary"
                        />
                        <span>Ride Service Rider</span>
                      </label>
                    </div>
                  </div>

                  {formData.driverType === 'RIDE_SERVICE' && (
                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Vehicle Category</Label>
                        <div className="flex space-x-4">
                          <label className="flex items-center space-x-2">
                            <input
                              type="radio"
                              name="rideServiceCategory"
                              value="TRADITIONAL_TAXI"
                              checked={formData.rideServiceCategory === 'TRADITIONAL_TAXI'}
                              onChange={() => setFormData(prev => ({ 
                                ...prev, 
                                rideServiceCategory: 'TRADITIONAL_TAXI',
                                rideVehicleType: '',
                                rideVehicleCapacity: undefined,
                              }))}
                            />
                            <span>Traditional Taxi</span>
                          </label>
                          <label className="flex items-center space-x-2">
                            <input
                              type="radio"
                              name="rideServiceCategory"
                              value="LIMOUSINE"
                              checked={formData.rideServiceCategory === 'LIMOUSINE'}
                              onChange={() => setFormData(prev => ({ 
                                ...prev, 
                                rideServiceCategory: 'LIMOUSINE',
                                rideVehicleType: '',
                                rideVehicleCapacity: undefined,
                              }))}
                            />
                            <span>Limousine</span>
                          </label>
                        </div>
                      </div>

                      {formData.rideServiceCategory && (
                        <div className="space-y-2">
                          <Label>Vehicle Type</Label>
                          <div className="grid grid-cols-1 gap-2">
                            {(formData.rideServiceCategory === 'TRADITIONAL_TAXI' ? TAXI_TYPES : LIMO_TYPES).map(opt => (
                              <label key={opt.value} className="flex items-center space-x-2">
                                <input
                                  type="radio"
                                  name="rideVehicleType"
                                  value={opt.value}
                                  checked={formData.rideVehicleType === opt.value}
                                  onChange={() => setFormData(prev => ({ 
                                    ...prev, 
                                    rideVehicleType: opt.value,
                                    rideVehicleCapacity: opt.capacity,
                                  }))}
                                />
                                <span>{opt.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="available"
                        name="available"
                        checked={formData.available}
                        onCheckedChange={(checked) =>
                          setFormData(prev => ({ ...prev, available: checked as boolean }))
                        }
                      />
                      <Label htmlFor="available">Available for service</Label>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Service Areas</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {emirates.map((emirate) => (
                      <div key={emirate.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`emirate-${emirate.id}`}
                          checked={formData.emirateIds.includes(emirate.id)}
                          onCheckedChange={() => handleEmirateChange(emirate.id)}
                        />
                        <Label htmlFor={`emirate-${emirate.id}`}>{emirate.name}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(false);
                      setSelectedRider(null);
                      setFormData({ 
                        name: '', 
                        phone: '', 
                        available: true, 
                        driverType: 'DELIVERY',
                        emirateIds: [],
                        rideServiceCategory: null,
                        rideVehicleType: '',
                        rideVehicleCapacity: undefined,
                      });
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">
                    {selectedRider ? 'Update' : 'Create'} Rider
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex items-center space-x-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search riders by name or phone..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Service Areas</TableHead>
                <TableHead>Deliveries</TableHead>
                <TableHead>Member Since</TableHead>
                <TableHead>Ride Details</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredRiders.length > 0 ? (
                filteredRiders.map((rider) => (
                  <TableRow key={rider.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center space-x-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <span>{rider.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{rider.phone}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        rider.driverType === 'DELIVERY' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {rider.driverType === 'DELIVERY' ? 'Delivery' : 'Ride Service'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {rider.driverType === 'RIDE_SERVICE' ? (
                        <div className="text-xs text-muted-foreground">
                          {rider.rideServiceCategory === 'TRADITIONAL_TAXI' ? 'Traditional Taxi' : rider.rideServiceCategory === 'LIMOUSINE' ? 'Limousine' : ''}
                          {rider.rideVehicleType ? ` • ${rider.rideVehicleType}` : ''}
                          {rider.rideVehicleCapacity ? ` • ${rider.rideVehicleCapacity} people` : ''}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <div className={`h-2 w-2 rounded-full mr-2 ${rider.available ? 'bg-green-500' : 'bg-gray-400'}`} />
                        {rider.available ? 'Available' : 'Unavailable'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {rider.emirates.map(em => (
                          <span 
                            key={em.emirate.id}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                          >
                            <MapPin className="h-3 w-3 mr-1" />
                            {em.emirate.name}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{rider._count.deliveries} deliveries</TableCell>
                    <TableCell>{formatDate(rider.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(rider)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedRider(rider);
                            setIsDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    {searchTerm ? 'No matching riders found' : 'No riders found'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedRider?.name} and all their data. This action
              cannot be undone.
              {selectedRider?._count?.deliveries !== undefined && selectedRider?._count?.deliveries > 0 && (
                <div className="mt-2 text-red-600 font-medium">
                  Note: This rider has {selectedRider?._count?.deliveries} deliveries associated with them.
                  You cannot delete a rider with existing deliveries.
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={selectedRider?._count?.deliveries !== undefined && selectedRider?._count?.deliveries > 0}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
