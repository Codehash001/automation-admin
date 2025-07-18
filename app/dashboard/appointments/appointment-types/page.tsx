"use client";

import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Search, AlertCircle, Filter, Calendar, Building2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';

interface AppointmentType {
  id: number;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    places: number;
  };
}

export default function AppointmentTypesPage() {
  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentType[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<AppointmentType | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  // Fetch appointment types
  const fetchAppointmentTypes = async () => {
    try {
      const response = await fetch('/api/appointments/appointment-types?includeAppointmentCounts=true');
      if (!response.ok) throw new Error('Failed to fetch appointment types');
      
      const data = await response.json();
      setAppointmentTypes(data || []);
    } catch (error) {
      console.error('Error fetching appointment types:', error);
      toast({
        title: 'Error',
        description: 'Failed to load appointment types',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDialog = (type: AppointmentType | null = null) => {
    if (type) {
      setSelectedType(type);
      setFormData({
        name: type.name,
        description: type.description || '',
      });
    } else {
      setSelectedType(null);
      setFormData({
        name: '',
        description: '',
      });
    }
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (type: AppointmentType) => {
    setSelectedType(type);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const url = '/api/appointments/appointment-types';
      const method = selectedType ? 'PUT' : 'POST';
      
      const payload = {
        ...(selectedType && { id: selectedType.id }),
        name: formData.name,
        description: formData.description || null,
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save appointment type');
      }

      toast({
        title: 'Success',
        description: `Appointment type ${selectedType ? 'updated' : 'created'} successfully`,
      });

      setIsDialogOpen(false);
      fetchAppointmentTypes();
    } catch (error: any) {
      console.error('Error saving appointment type:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save appointment type',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!selectedType) return;

    try {
      const response = await fetch(`/api/appointments/appointment-types?id=${selectedType.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete appointment type');
      }

      toast({
        title: 'Success',
        description: 'Appointment type deleted successfully',
      });

      setIsDeleteDialogOpen(false);
      fetchAppointmentTypes();
    } catch (error: any) {
      console.error('Error deleting appointment type:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete appointment type',
        variant: 'destructive',
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getTypeIcon = (name: string) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('salon') || lowerName.includes('beauty')) {
      return '✂️';
    } else if (lowerName.includes('doctor') || lowerName.includes('medical') || lowerName.includes('health')) {
      return '🩺';
    } else if (lowerName.includes('legal') || lowerName.includes('law')) {
      return '⚖️';
    } else if (lowerName.includes('restaurant') || lowerName.includes('food') || lowerName.includes('dining')) {
      return '🍽️';
    } else if (lowerName.includes('fitness') || lowerName.includes('gym')) {
      return '💪';
    } else if (lowerName.includes('education') || lowerName.includes('school')) {
      return '📚';
    } else if (lowerName.includes('automotive') || lowerName.includes('car')) {
      return '🚗';
    } else {
      return '📅';
    }
  };

  useEffect(() => {
    fetchAppointmentTypes();
  }, []);

  // Filter appointment types based on search term
  const filteredTypes = appointmentTypes.filter((type: any) =>
    type.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (type.description && type.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Calendar className="h-6 w-6 text-blue-600" />
              <div>
                <CardTitle>Appointment Types Management</CardTitle>
                <CardDescription>Manage appointment service categories like salon, doctor, legal, restaurant, etc.</CardDescription>
              </div>
            </div>
            <Button onClick={() => handleOpenDialog()} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Add Appointment Type
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search appointment types..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="flex items-center p-6">
                <Calendar className="h-8 w-8 text-blue-600 mr-3" />
                <div>
                  <p className="text-2xl font-bold">{appointmentTypes.length}</p>
                  <p className="text-sm text-gray-600">Total Types</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center p-6">
                <Building2 className="h-8 w-8 text-green-600 mr-3" />
                <div>
                  <p className="text-2xl font-bold">
                    {appointmentTypes.reduce((sum, type) => sum + (type._count?.places || 0), 0)}
                  </p>
                  <p className="text-sm text-gray-600">Total Places</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center p-6">
                <Users className="h-8 w-8 text-purple-600 mr-3" />
                <div>
                  <p className="text-2xl font-bold">
                    {appointmentTypes.filter((type: any) => (type._count?.places || 0) > 0).length}
                  </p>
                  <p className="text-sm text-gray-600">Active Types</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">Loading appointment types...</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Places</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTypes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                        {searchTerm ? 'No appointment types found matching your search.' : 'No appointment types created yet.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTypes.map((type) => (
                      <TableRow key={type.id}>
                        <TableCell>
                          <div className="text-2xl">{getTypeIcon(type.name)}</div>
                        </TableCell>
                        <TableCell className="font-medium">{type.name}</TableCell>
                        <TableCell>
                          {type.description ? (
                            <span className="text-gray-600 max-w-[300px] truncate block" title={type.description}>
                              {type.description}
                            </span>
                          ) : (
                            <span className="text-gray-400 italic">No description</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            {type._count?.places || 0} places
                          </Badge>
                        </TableCell>
                        <TableCell className="text-gray-600">
                          {formatDate(type.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenDialog(type)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteClick(type)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Calendar className="h-5 w-5 mr-2 text-blue-600" />
              {selectedType ? 'Edit Appointment Type' : 'Add New Appointment Type'}
            </DialogTitle>
            <DialogDescription>
              {selectedType 
                ? 'Update the appointment type details below.' 
                : 'Create a new appointment service category like salon, doctor, legal, restaurant, etc.'
              }
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="name">Type Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Salon, Medical Centre, Legal Advisor, Restaurant"
                  required
                />
                <p className="text-sm text-gray-500 mt-1">
                  This will be used as the category name for appointment services
                </p>
              </div>
              
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description of this appointment type..."
                  rows={3}
                />
                <p className="text-sm text-gray-500 mt-1">
                  Provide additional details about this appointment category (optional)
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                {selectedType ? 'Update' : 'Create'} Type
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Appointment Type</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the appointment type "{selectedType?.name}"?
              {selectedType && (selectedType._count?.places ?? 0) > 0 && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                  <div className="flex items-center text-red-800">
                    <AlertCircle className="h-4 w-4 mr-2" />
                    <span className="font-medium">Cannot delete this type</span>
                  </div>
                  <p className="text-red-700 text-sm mt-1">
                    This appointment type has {selectedType._count?.places} associated place(s). 
                    Please delete or reassign the places first.
                  </p>
                </div>
              )}
              {selectedType && (selectedType._count?.places ?? 0) === 0 && (
                <div className="mt-2 text-amber-600">
                  This action cannot be undone.
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={(selectedType?._count?.places ?? 0) > 0}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
