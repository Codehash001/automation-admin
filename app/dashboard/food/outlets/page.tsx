"use client";

import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Search, AlertCircle, Utensils, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Types
type Outlet = {
  id: number;
  name: string;
  whatsappNo: string;
  status: 'OPEN' | 'BUSY' | 'CLOSED';
  emirates: {
    id: number;
    name: string;
  };
  cuisines: {
    cuisine: {
      id: number;
      name: string;
    };
  }[];
  _count: {
    menus: number;
    orders: number;
  };
  createdAt: string;
};

type Emirates = {
  id: number;
  name: string;
};

type Cuisine = {
  id: number;
  name: string;
};

export default function OutletsPage() {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [emirates, setEmirates] = useState<Emirates[]>([]);
  const [cuisines, setCuisines] = useState<Cuisine[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedOutlet, setSelectedOutlet] = useState<Outlet | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    emiratesId: '',
    cuisineIds: [] as string[],
    whatsappNo: '',
    status: 'OPEN' as 'OPEN' | 'BUSY' | 'CLOSED',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEmirateDialogOpen, setIsEmirateDialogOpen] = useState(false);
  const [newEmirateName, setNewEmirateName] = useState('');
  const [isCreatingEmirate, setIsCreatingEmirate] = useState(false);
  const { toast } = useToast();

  // Fetch data
  const fetchData = async () => {
    try {
      setIsLoading(true);
      
      // Fetch all required data in parallel
      const [outletsRes, emiratesRes, cuisinesRes] = await Promise.all([
        fetch('/api/food/outlet'),
        fetch('/api/emirates'),
        fetch('/api/food/cuisine'),
      ]);

      if (!outletsRes.ok) throw new Error('Failed to fetch outlets');
      if (!emiratesRes.ok) throw new Error('Failed to fetch emirates');
      if (!cuisinesRes.ok) throw new Error('Failed to fetch cuisines');

      const [outletsData, emiratesData, cuisinesData] = await Promise.all([
        outletsRes.json(),
        emiratesRes.json(),
        cuisinesRes.json(),
      ]);

      setOutlets(outletsData);
      setEmirates(emiratesData);
      setCuisines(cuisinesData);
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

  // Filter outlets based on search term
  const filteredOutlets = outlets.filter((outlet) =>
    outlet.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    outlet.whatsappNo.includes(searchTerm)
  );

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle select changes
  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle cuisine selection
  const handleCuisineChange = (cuisineId: string, isChecked: boolean) => {
    setFormData(prev => {
      const newCuisineIds = isChecked
        ? [...prev.cuisineIds, cuisineId]
        : prev.cuisineIds.filter(id => id !== cuisineId);
      
      return {
        ...prev,
        cuisineIds: newCuisineIds,
      };
    });
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      emiratesId: '',
      cuisineIds: [],
      whatsappNo: '',
      status: 'OPEN',
    });
    setSelectedOutlet(null);
  };

  // Open edit dialog
  const handleEdit = (outlet: Outlet) => {
    setSelectedOutlet(outlet);
    setFormData({
      name: outlet.name,
      emiratesId: outlet.emirates.id.toString(),
      cuisineIds: outlet.cuisines.map(c => c.cuisine.id.toString()),
      whatsappNo: outlet.whatsappNo,
      status: outlet.status,
    });
    setIsDialogOpen(true);
  };

  // Open delete confirmation
  const handleDeleteClick = (outlet: Outlet) => {
    setSelectedOutlet(outlet);
    setIsDeleteDialogOpen(true);
  };

  // Handle form submission (create/update)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.name.trim()) {
      toast({
        title: 'Error',
        description: 'Outlet name is required',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.emiratesId) {
      toast({
        title: 'Error',
        description: 'Please select an emirate',
        variant: 'destructive',
      });
      return;
    }

    if (formData.cuisineIds.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one cuisine',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const url = selectedOutlet 
        ? `/api/food/outlet?id=${selectedOutlet.id}`
        : '/api/food/outlet';
      
      const method = selectedOutlet ? 'PUT' : 'POST';
      const payload = {
        name: formData.name.trim(),
        emiratesId: parseInt(formData.emiratesId),
        cuisineIds: formData.cuisineIds.map(id => parseInt(id)),
        whatsappNo: formData.whatsappNo.trim(),
        status: formData.status,
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save outlet');
      }

      toast({
        title: 'Success',
        description: selectedOutlet 
          ? 'Outlet updated successfully' 
          : 'Outlet created successfully',
      });

      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving outlet:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save outlet',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!selectedOutlet) return;
    
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/food/outlet?id=${selectedOutlet.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete outlet');
      }

      toast({
        title: 'Success',
        description: 'Outlet deleted successfully',
      });

      setIsDeleteDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error deleting outlet:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete outlet',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
      setSelectedOutlet(null);
    }
  };

  // Create new emirate
  const handleCreateEmirate = async () => {
    if (!newEmirateName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter an emirate name',
        variant: 'destructive',
      });
      return;
    }

    setIsCreatingEmirate(true);
    try {
      const response = await fetch('/api/emirates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newEmirateName.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          // Handle duplicate emirate
          const existingEmirate = emirates.find(e => 
            e.name.toLowerCase() === newEmirateName.trim().toLowerCase()
          );
          
          if (existingEmirate) {
            setFormData(prev => ({
              ...prev,
              emiratesId: existingEmirate.id.toString(),
            }));
          }
          
          toast({
            title: 'Emirate Exists',
            description: 'This emirate already exists',
            variant: 'default',
          });
          return;
        }
        throw new Error(data.error || 'Failed to create emirate');
      }

      // Update emirates list and select the new emirate
      const newEmirate = data;
      setEmirates(prev => [...prev, newEmirate]);
      
      setFormData(prev => ({
        ...prev,
        emiratesId: newEmirate.id.toString(),
      }));
      
      setNewEmirateName('');
      setIsEmirateDialogOpen(false);
      
      toast({
        title: 'Success',
        description: 'Emirate created successfully',
      });
    } catch (error) {
      console.error('Error creating emirate:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create emirate',
        variant: 'destructive',
      });
    } finally {
      setIsCreatingEmirate(false);
    }
  };

  // Get status badge variant
  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'OPEN':
        return 'default';
      case 'BUSY':
        return 'warning';
      case 'CLOSED':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Outlets</h1>
          <p className="text-muted-foreground">
            Manage your restaurant outlets
          </p>
        </div>
        <Button 
          onClick={() => {
            resetForm();
            setIsDialogOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Outlet
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search outlets by name or WhatsApp number..."
          className="pl-9"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Outlets Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Cuisines</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  Loading outlets...
                </TableCell>
              </TableRow>
            ) : filteredOutlets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  {searchTerm ? 'No matching outlets found' : 'No outlets added yet'}
                </TableCell>
              </TableRow>
            ) : (
              filteredOutlets.map((outlet) => (
                <TableRow key={outlet.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Utensils className="h-4 w-4 text-muted-foreground" />
                      {outlet.name}
                    </div>
                  </TableCell>
                  <TableCell>{outlet.emirates.name}</TableCell>
                  <TableCell>
                    {outlet.cuisines.map(c => c.cuisine.name).join(', ')}
                  </TableCell>
                  <TableCell>
                    <Badge>
                      {outlet.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Phone className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm">{outlet.whatsappNo}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(outlet)}
                      >
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Edit</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDeleteClick(outlet)}
                        disabled={outlet._count.menus > 0 || outlet._count.orders > 0}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add/Edit Outlet Dialog */}
      <Dialog 
        open={isDialogOpen} 
        onOpenChange={(open) => {
          if (!open) {
            setIsDialogOpen(false);
            resetForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-[600px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{selectedOutlet ? 'Edit Outlet' : 'Add New Outlet'}</DialogTitle>
              <DialogDescription>
                {selectedOutlet ? 'Update the outlet details' : 'Fill in the details for the new outlet'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {/* Outlet Name */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Outlet Name</label>
                <Input
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Enter outlet name"
                  required
                />
              </div>

              {/* Emirates Selection */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium">Emirates</label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-sm text-primary"
                    onClick={() => setIsEmirateDialogOpen(true)}
                  >
                    + Add New
                  </Button>
                </div>
                <Select
                  value={formData.emiratesId}
                  onValueChange={(value) => handleSelectChange('emiratesId', value)}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select emirate" />
                  </SelectTrigger>
                  <SelectContent>
                    {emirates.map((emirate) => (
                      <SelectItem key={emirate.id} value={emirate.id.toString()}>
                        {emirate.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Cuisines Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Cuisines</label>
                <div className="border rounded-md p-2 max-h-40 overflow-y-auto">
                  {cuisines.map((cuisine) => (
                    <div key={cuisine.id} className="flex items-center space-x-2 p-1">
                      <input
                        type="checkbox"
                        id={`cuisine-${cuisine.id}`}
                        checked={formData.cuisineIds.includes(cuisine.id.toString())}
                        onChange={(e) => handleCuisineChange(cuisine.id.toString(), e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <label htmlFor={`cuisine-${cuisine.id}`} className="text-sm">
                        {cuisine.name}
                      </label>
                    </div>
                  ))}
                </div>
                {formData.cuisineIds.length === 0 && (
                  <p className="text-xs text-red-500">Please select at least one cuisine</p>
                )}
              </div>

              {/* WhatsApp Number */}
              <div className="space-y-2">
                <label className="text-sm font-medium">WhatsApp Number</label>
                <Input
                  name="whatsappNo"
                  value={formData.whatsappNo}
                  onChange={handleInputChange}
                  placeholder="Enter WhatsApp number with country code"
                  required
                />
              </div>

              {/* Status */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => handleSelectChange('status', value as any)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPEN">Open</SelectItem>
                    <SelectItem value="BUSY">Busy</SelectItem>
                    <SelectItem value="CLOSED">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setIsDialogOpen(false);
                  resetForm();
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Emirate Dialog */}
      <Dialog open={isEmirateDialogOpen} onOpenChange={setIsEmirateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Emirate</DialogTitle>
            <DialogDescription>
              Enter the name of the new emirate.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="emirate-name">
                Emirate Name
              </label>
              <Input
                id="emirate-name"
                value={newEmirateName}
                onChange={(e) => setNewEmirateName(e.target.value)}
                placeholder="e.g. Dubai, Abu Dhabi"
                disabled={isCreatingEmirate}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEmirateDialogOpen(false)}
              disabled={isCreatingEmirate}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreateEmirate}
              disabled={!newEmirateName.trim() || isCreatingEmirate}
            >
              {isCreatingEmirate ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <DialogTitle>Delete Outlet</DialogTitle>
            </div>
            <DialogDescription>
              Are you sure you want to delete the outlet "{selectedOutlet?.name}"?
              {(selectedOutlet?._count.menus ?? 0) > 0 && (
                <div className="mt-2 text-destructive">
                  This outlet has {selectedOutlet?._count.menus} menu(s) and {selectedOutlet?._count.orders} order(s) and cannot be deleted.
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setSelectedOutlet(null);
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={
                isSubmitting || 
                (selectedOutlet?._count.menus ?? 0) > 0 || 
                (selectedOutlet?._count.orders ?? 0) > 0
              }
            >
              {isSubmitting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}