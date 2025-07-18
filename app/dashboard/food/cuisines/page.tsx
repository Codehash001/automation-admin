"use client";

import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Search, AlertCircle } from 'lucide-react';
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

type Cuisine = {
  id: number;
  name: string;
  _count: {
    outlets: number;
  };
  createdAt: string;
};

export default function CuisinesPage() {
  const [cuisines, setCuisines] = useState<Cuisine[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCuisine, setSelectedCuisine] = useState<Cuisine | null>(null);
  const [formData, setFormData] = useState({
    name: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Fetch cuisines
  const fetchCuisines = async () => {
    try {
      const response = await fetch('/api/food/cuisine');
      if (!response.ok) throw new Error('Failed to fetch cuisines');
      const data = await response.json();
      setCuisines(data);
    } catch (error) {
      console.error('Error fetching cuisines:', error);
      toast({
        title: 'Error',
        description: 'Failed to load cuisines',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCuisines();
  }, []);

  // Filter cuisines based on search term
  const filteredCuisines = cuisines.filter((cuisine: any) =>
    cuisine.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Reset form
  const resetForm = () => {
    setFormData({ name: '' });
    setSelectedCuisine(null);
  };

  // Open edit dialog
  const handleEdit = (cuisine: Cuisine) => {
    setSelectedCuisine(cuisine);
    setFormData({
      name: cuisine.name,
    });
    setIsDialogOpen(true);
  };

  // Open delete confirmation
  const handleDeleteClick = (cuisine: Cuisine) => {
    setSelectedCuisine(cuisine);
    setIsDeleteDialogOpen(true);
  };

  // Handle form submission (create/update)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = selectedCuisine 
        ? `/api/food/cuisine?id=${selectedCuisine.id}`
        : '/api/food/cuisine';
      
      const method = selectedCuisine ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save cuisine');
      }

      toast({
        title: 'Success',
        description: selectedCuisine 
          ? 'Cuisine updated successfully' 
          : 'Cuisine created successfully',
      });

      setIsDialogOpen(false);
      resetForm();
      fetchCuisines();
    } catch (error) {
      console.error('Error saving cuisine:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save cuisine',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!selectedCuisine) return;
    
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/food/cuisine?id=${selectedCuisine.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete cuisine');
      }

      toast({
        title: 'Success',
        description: 'Cuisine deleted successfully',
      });

      setIsDeleteDialogOpen(false);
      fetchCuisines();
    } catch (error) {
      console.error('Error deleting cuisine:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete cuisine',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
      setSelectedCuisine(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Cuisines</h1>
          <p className="text-muted-foreground">
            Manage your restaurant cuisines
          </p>
        </div>
        <Button onClick={() => {
          resetForm();
          setIsDialogOpen(true);
        }}>
          <Plus className="mr-2 h-4 w-4" />
          Add Cuisine
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search cuisines..."
          className="pl-9"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Used in Outlets</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8">
                  Loading cuisines...
                </TableCell>
              </TableRow>
            ) : filteredCuisines.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8">
                  {searchTerm ? 'No matching cuisines found' : 'No cuisines added yet'}
                </TableCell>
              </TableRow>
            ) : (
              filteredCuisines.map((cuisine) => (
                <TableRow key={cuisine.id}>
                  <TableCell className="font-medium">{cuisine.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {cuisine._count.outlets} outlets
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(cuisine)}
                      >
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Edit</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDeleteClick(cuisine)}
                        disabled={cuisine._count.outlets > 0}
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

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsDialogOpen(false);
          resetForm();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedCuisine ? 'Edit Cuisine' : 'Add New Cuisine'}
            </DialogTitle>
            <DialogDescription>
              {selectedCuisine 
                ? 'Update the cuisine details below.'
                : 'Fill in the details to add a new cuisine.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium leading-none">
                  Name <span className="text-destructive">*</span>
                </label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g., Italian, Chinese, Indian"
                  required
                />
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
                {isSubmitting ? (
                  'Saving...'
                ) : selectedCuisine ? (
                  'Update Cuisine'
                ) : (
                  'Add Cuisine'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <DialogTitle>Delete Cuisine</DialogTitle>
            </div>
            <DialogDescription>
              Are you sure you want to delete the cuisine "{selectedCuisine?.name}"?
              {(selectedCuisine?._count?.outlets ?? 0) > 0 && (
                <div className="mt-2 text-destructive">
                  This cuisine is used in {selectedCuisine?._count?.outlets} outlet(s) and cannot be deleted.
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setSelectedCuisine(null);
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isSubmitting || (selectedCuisine?._count?.outlets ?? 0) > 0}
            >
              {isSubmitting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
