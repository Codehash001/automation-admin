"use client";

import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Search, AlertCircle, Filter, Calendar, Clock, User, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Appointment {
  id: number;
  appointmentDate: string;
  status: string;
  numberOfTables?: number | null;
  appointmentSetter?: string | null;
  customer: {
    id: number;
    name: string;
    phone: string;
  };
  appointmentPlace: {
    id: number;
    name: string;
    specialistName: string | null;
    whatsappNo: string;
    address: string;
    appointmentType: {
      id: number;
      name: string;
    };
  };
  createdAt: string;
  updatedAt: string;
}

interface Customer {
  id: number;
  name: string;
  phone: string;
}

interface AppointmentType {
  id: number;
  name: string;
  description: string | null;
}

interface AppointmentPlace {
  id: number;
  name: string;
  specialistName: string | null;
  appointmentType: {
    id: number;
    name: string;
  };
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentType[]>([]);
  const [appointmentPlaces, setAppointmentPlaces] = useState<AppointmentPlace[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('all');
  const [selectedAppointmentType, setSelectedAppointmentType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [filteredAppointmentPlaces, setFilteredAppointmentPlaces] = useState<AppointmentPlace[]>([]);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    customerId: '',
    appointmentPlaceId: '',
    appointmentDate: '',
    status: 'PENDING',
    numberOfTables: '', // only for Restaurant
    appointmentSetter: '',
  });

  // Fetch appointments
  const fetchAppointments = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedCustomer && selectedCustomer !== 'all') params.append('customerId', selectedCustomer);
      if (selectedAppointmentType && selectedAppointmentType !== 'all') params.append('appointmentTypeId', selectedAppointmentType);
      if (selectedStatus && selectedStatus !== 'all') params.append('status', selectedStatus);
      
      const response = await fetch(`/api/appointments?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch appointments');
      
      const data = await response.json();
      setAppointments(data);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      toast({
        title: 'Error',
        description: 'Failed to load appointments',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch customers
  const fetchCustomers = async () => {
    try {
      const response = await fetch('/api/customers');
      if (!response.ok) throw new Error('Failed to fetch customers');
      const data = await response.json();
      setCustomers(data);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  // Fetch appointment types
  const fetchAppointmentTypes = async () => {
    try {
      const response = await fetch('/api/appointments/appointment-types');
      if (!response.ok) throw new Error('Failed to fetch appointment types');
      const data = await response.json();
      setAppointmentTypes(data);
    } catch (error) {
      console.error('Error fetching appointment types:', error);
    }
  };

  // Fetch appointment places
  const fetchAppointmentPlaces = async () => {
    try {
      const response = await fetch('/api/appointments/appointment-places/all');
      if (!response.ok) {
        // If the all endpoint doesn't exist, we'll need to fetch from each type
        const typePromises = appointmentTypes.map(async (type) => {
          const res = await fetch(`/api/appointments/appointment-places/${type.name.toLowerCase()}`);
          if (res.ok) {
            const data = await res.json();
            return data.places || [];
          }
          return [];
        });
        const allPlaces = await Promise.all(typePromises);
        const flattenedPlaces = allPlaces.flat();
        setAppointmentPlaces(flattenedPlaces);
        setFilteredAppointmentPlaces(flattenedPlaces);
        return;
      }
      const data = await response.json();
      setAppointmentPlaces(data);
      setFilteredAppointmentPlaces(data);
    } catch (error) {
      console.error('Error fetching appointment places:', error);
    }
  };

  useEffect(() => {
    fetchAppointments();
    fetchCustomers();
    fetchAppointmentTypes();
  }, [selectedCustomer, selectedAppointmentType, selectedStatus]);

  useEffect(() => {
    if (appointmentTypes.length > 0) {
      fetchAppointmentPlaces();
    }
  }, [appointmentTypes]);

  // Filter appointment places based on selected type
  useEffect(() => {
    if (selectedAppointmentType && selectedAppointmentType !== 'all') {
      const filtered = appointmentPlaces.filter((place: any) => 
        place.appointmentType.id.toString() === selectedAppointmentType
      );
      setFilteredAppointmentPlaces(filtered);
    } else {
      setFilteredAppointmentPlaces(appointmentPlaces);
    }
  }, [selectedAppointmentType, appointmentPlaces]);

  const filteredAppointments = appointments.filter((appointment: any) => 
    appointment.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    appointment.appointmentPlace.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    appointment.appointmentPlace.appointmentType.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenDialog = (appointment: Appointment | null = null) => {
    if (appointment) {
      setSelectedAppointment(appointment);
      setFormData({
        customerId: appointment.customer.id.toString(),
        appointmentPlaceId: appointment.appointmentPlace.id.toString(),
        appointmentDate: new Date(appointment.appointmentDate).toISOString().slice(0, 16),
        status: appointment.status,
        numberOfTables:
          appointment.appointmentPlace.appointmentType.name.toLowerCase() === 'restaurant' &&
          typeof appointment.numberOfTables === 'number'
            ? String(appointment.numberOfTables)
            : '',
        appointmentSetter: appointment.appointmentSetter || '',
      });
    } else {
      setSelectedAppointment(null);
      setFormData({
        customerId: '',
        appointmentPlaceId: '',
        appointmentDate: '',
        status: 'SCHEDULED',
        numberOfTables: '',
        appointmentSetter: '',
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedAppointment(null);
    setFormData({
      customerId: '',
      appointmentPlaceId: '',
      appointmentDate: '',
      status: 'SCHEDULED',
      numberOfTables: '',
      appointmentSetter: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.customerId || !formData.appointmentPlaceId || !formData.appointmentDate) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      const url = selectedAppointment ? '/api/appointments' : '/api/appointments';
      const method = selectedAppointment ? 'PUT' : 'POST';
      
      const body = selectedAppointment 
        ? { id: selectedAppointment.id, ...formData }
        : formData;

      // Determine if selected place is a Restaurant
      const selectedPlace = appointmentPlaces.find(
        (p: any) => p.id.toString() === formData.appointmentPlaceId
      );
      const isRestaurant = selectedPlace?.appointmentType?.name?.toLowerCase() === 'restaurant';

      const payload: any = {
        ...body,
        customerId: parseInt(formData.customerId),
        appointmentPlaceId: parseInt(formData.appointmentPlaceId),
        appointmentDate: new Date(formData.appointmentDate).toISOString(),
        ...(formData.appointmentSetter
          ? { appointmentSetter: formData.appointmentSetter.trim() }
          : selectedAppointment ? { appointmentSetter: '' } : {}),
      };

      if (isRestaurant) {
        if (formData.numberOfTables) {
          const num = parseInt(formData.numberOfTables, 10);
          if (!Number.isFinite(num) || num <= 0) {
            throw new Error('Number of tables must be a positive integer');
          }
          payload.numberOfTables = num;
        }
      } else if (selectedAppointment) {
        // For non-restaurant updates, explicitly clear if previously set
        payload.numberOfTables = null;
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save appointment');
      }

      toast({
        title: 'Success',
        description: `Appointment ${selectedAppointment ? 'updated' : 'created'} successfully`,
      });

      handleCloseDialog();
      fetchAppointments();
    } catch (error) {
      console.error('Error saving appointment:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save appointment',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!selectedAppointment) return;

    try {
      const response = await fetch(`/api/appointments?id=${selectedAppointment.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete appointment');
      }

      toast({
        title: 'Success',
        description: 'Appointment deleted successfully',
      });

      setIsDeleteDialogOpen(false);
      setSelectedAppointment(null);
      fetchAppointments();
    } catch (error) {
      console.error('Error deleting appointment:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete appointment',
        variant: 'destructive',
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'default';
      case 'scheduled':
        return 'default';
      case 'completed':
        return 'secondary';
      case 'cancelled':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Appointments</h1>
          <p className="text-muted-foreground">
            Manage customer appointments across all service types
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Add Appointment
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Filter appointments by customer, service type, or status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search appointments..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="w-full md:w-[200px]">
              <Select
                value={selectedCustomer}
                onValueChange={setSelectedCustomer}
              >
                <SelectTrigger>
                  <div className="flex items-center">
                    <User className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter by Customer" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers</SelectItem>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id.toString()}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full md:w-[200px]">
              <Select
                value={selectedAppointmentType}
                onValueChange={setSelectedAppointmentType}
              >
                <SelectTrigger>
                  <div className="flex items-center">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter by Type" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {appointmentTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id.toString()}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full md:w-[200px]">
              <Select
                value={selectedStatus}
                onValueChange={setSelectedStatus}
              >
                <SelectTrigger>
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter by Status" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-4">Loading appointments...</div>
          ) : filteredAppointments.length === 0 ? (
            <div className="text-center py-4">No appointments found</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Service Type</TableHead>
                    <TableHead>Place</TableHead>
                    <TableHead>Specialist</TableHead>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAppointments.map((appointment) => (
                    <TableRow key={appointment.id}>
                      <TableCell className="font-medium">
                        <div>
                          <div>{appointment.customer.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {appointment.customer.phone}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {appointment.appointmentPlace.appointmentType.name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{appointment.appointmentPlace.name}</div>
                          <div className="text-sm text-muted-foreground flex items-center">
                            <MapPin className="h-3 w-3 mr-1" />
                            {appointment.appointmentPlace.address}
                          </div>
                          {appointment.appointmentSetter && (
                            <div className="text-xs mt-1">
                              Set by: {appointment.appointmentSetter}
                            </div>
                          )}
                          {appointment.appointmentPlace.appointmentType.name.toLowerCase() === 'restaurant' &&
                            typeof appointment.numberOfTables === 'number' && (
                              <div className="text-xs mt-1">
                                Tables: {appointment.numberOfTables}
                              </div>
                            )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {appointment.appointmentPlace.specialistName || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2" />
                          {formatDate(appointment.appointmentDate)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(appointment.status)}>
                          {appointment.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(appointment)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedAppointment(appointment);
                              setIsDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {selectedAppointment ? 'Edit Appointment' : 'Add New Appointment'}
            </DialogTitle>
            <DialogDescription>
              {selectedAppointment 
                ? 'Update the appointment details below.' 
                : 'Fill in the details to create a new appointment.'
              }
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customerId">Customer *</Label>
              <Select
                value={formData.customerId}
                onValueChange={(value) => setFormData({ ...formData, customerId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id.toString()}>
                      {customer.name} - {customer.phone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="appointmentPlaceId">Service Place *</Label>
              <Select
                value={formData.appointmentPlaceId}
                onValueChange={(value) => setFormData({ ...formData, appointmentPlaceId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select service place" />
                </SelectTrigger>
                <SelectContent>
                  {filteredAppointmentPlaces.map((place) => (
                    <SelectItem key={place.id} value={place.id.toString()}>
                      {place.name} ({place.appointmentType.name})
                      {place.specialistName && ` - ${place.specialistName}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(() => {
              const place = appointmentPlaces.find(
                (p: any) => p.id.toString() === formData.appointmentPlaceId
              );
              const isRestaurant = place?.appointmentType?.name?.toLowerCase() === 'restaurant';
              if (!isRestaurant) return null;
              return (
                <div className="space-y-2">
                  <Label htmlFor="numberOfTables">Number of Tables</Label>
                  <Input
                    id="numberOfTables"
                    type="number"
                    min={1}
                    value={formData.numberOfTables}
                    onChange={(e) => setFormData({ ...formData, numberOfTables: e.target.value })}
                    placeholder="Enter number of tables"
                  />
                </div>
              );
            })()}
            <div className="space-y-2">
              <Label htmlFor="appointmentDate">Date & Time *</Label>
              <Input
                id="appointmentDate"
                type="datetime-local"
                value={formData.appointmentDate}
                onChange={(e) => setFormData({ ...formData, appointmentDate: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="appointmentSetter">Appointment Setter</Label>
              <Input
                id="appointmentSetter"
                type="text"
                value={formData.appointmentSetter}
                onChange={(e) => setFormData({ ...formData, appointmentSetter: e.target.value })}
                placeholder="Enter the name of the person who set this appointment"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button type="submit">
                {selectedAppointment ? 'Update' : 'Create'} Appointment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Appointment</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this appointment? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span>
              {selectedAppointment && 
                `${selectedAppointment.customer.name} - ${selectedAppointment.appointmentPlace.name}`
              }
            </span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
