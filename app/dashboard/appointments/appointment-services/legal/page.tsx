"use client";

import { useState, useEffect, useRef } from 'react';
import { Plus, Pencil, Trash2, Search, AlertCircle, Filter, MapPin, Clock, Layers, Map, Scale, User, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Mapbox access token - you'll need to set this in your environment variables
const MAPBOX_ACCESS_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || 'your-mapbox-access-token-here';

interface LegalPlace {
  id: number;
  name: string;
  specialistName?: string; // legacy
  specialistNames?: string[]; // new array
  whatsappNo: string;
  status: 'ACTIVE' | 'INACTIVE';
  operatingHours?: {
    open: string;
    close: string;
  };
  exactLocation: {
    lat: number;
    lng: number;
  };
  address: string;
  _count?: {
    appointments: number;
  };
}

export default function LegalPage() {
  const [places, setPlaces] = useState<LegalPlace[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<LegalPlace | null>(null);
  const { toast } = useToast();

  // Map related state
  const mapRef = useRef<HTMLDivElement>(null);
  const mapboxMap = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [mapInitialized, setMapInitialized] = useState(false);
  const [mapStyle, setMapStyle] = useState<string>('standard');
  const currentZoomRef = useRef<number>(13);
  let isDragging = false;

  const [formData, setFormData] = useState({
    name: '',
    specialistName: '',
    whatsappNo: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
    operatingHours: {
      open: '09:00',
      close: '18:00',
    },
    exactLocation: {
      lat: '25.276987',
      lng: '55.296249',
    },
    address: '',
  });

  // Add-specialist dialog state
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [addSpecialistName, setAddSpecialistName] = useState('');
  const [addTargetPlace, setAddTargetPlace] = useState<LegalPlace | null>(null);

  // Fetch legal places
  const fetchPlaces = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      
      const response = await fetch(`/api/appointments/appointment-places/legal?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch legal advisors');
      
      const data = await response.json();
      setPlaces(data.places || []);
    } catch (error) {
      console.error('Error fetching legal advisors:', error);
      toast({
        title: 'Error',
        description: 'Failed to load legal advisors',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to create or update marker
  const createOrUpdateMarker = (mapboxgl: any, lng: string | number, lat: string | number) => {
    if (!mapboxMap.current) return;

    const longitude = typeof lng === 'string' ? parseFloat(lng) : lng;
    const latitude = typeof lat === 'string' ? parseFloat(lat) : lat;

    if (isNaN(longitude) || isNaN(latitude)) return;

    // Remove existing marker
    if (markerRef.current) {
      markerRef.current.remove();
    }

    // Create new draggable marker
    markerRef.current = new mapboxgl.Marker({ 
      draggable: true,
      color: '#8b5cf6', // Purple color for legal services
      center: [55.296249, 25.276987], // Dubai coordinates
      zoom: 13,
    })
      .setLngLat([longitude, latitude])
      .addTo(mapboxMap.current);

    // Add drag event listener
    markerRef.current.on('dragend', () => {
      if (markerRef.current) {
        const lngLat = markerRef.current.getLngLat();
        setFormData(prev => ({
          ...prev,
          exactLocation: {
            lat: lngLat.lat.toFixed(6),
            lng: lngLat.lng.toFixed(6),
          }
        }));
      }
    });

    // Center map on marker with preserved zoom
    mapboxMap.current.flyTo({
      center: [longitude, latitude],
      zoom: currentZoomRef.current,
      essential: true
    });
  };

  // Initialize map when dialog opens
  useEffect(() => {
    if (!isDialogOpen) {
      // Clean up map when dialog closes
      if (mapboxMap.current) {
        mapboxMap.current.remove();
        mapboxMap.current = null;
        markerRef.current = null;
      }
      setMapInitialized(false);
      return;
    }

    const timer = setTimeout(() => {
      if (!mapRef.current || mapInitialized) return;

      import('mapbox-gl').then((mapboxModule) => {
        if (!mapRef.current) return;
        
        const mapboxgl = mapboxModule.default;
        mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
        
        mapboxMap.current = new mapboxgl.Map({
          container: mapRef.current,
          style: `mapbox://styles/mapbox/${mapStyle}`,
          center: [55.296249, 25.276987], // Dubai coordinates
          zoom: 13,
        });

        // Store zoom level changes
        mapboxMap.current.on('zoomend', () => {
          if (mapboxMap.current) {
            currentZoomRef.current = mapboxMap.current.getZoom();
          }
        });

        // Add click handler to map
        mapboxMap.current.on('click', (e: any) => {
          const { lng, lat } = e.lngLat;
          
          setFormData(prev => ({
            ...prev,
            exactLocation: {
              lat: lat.toFixed(6),
              lng: lng.toFixed(6),
            }
          }));

          createOrUpdateMarker(mapboxgl, lng, lat);
        });

        // Force map to resize after a short delay
        setTimeout(() => {
          if (mapboxMap.current) {
            mapboxMap.current.resize();
          }
        }, 100);

        setMapInitialized(true);

        // If we have coordinates, add a marker
        if (formData.exactLocation.lat && formData.exactLocation.lng) {
          const lat = parseFloat(formData.exactLocation.lat);
          const lng = parseFloat(formData.exactLocation.lng);
          
          if (!isNaN(lat) && !isNaN(lng)) {
            createOrUpdateMarker(mapboxgl, lng, lat);
          }
        }
      });
    }, 100);

    return () => {
      clearTimeout(timer);
      if (mapboxMap.current) {
        mapboxMap.current.remove();
        mapboxMap.current = null;
        markerRef.current = null;
      }
    };
  }, [isDialogOpen, mapStyle]);

  // Update marker when form data changes
  useEffect(() => {
    if (mapInitialized && formData.exactLocation.lat !== '0' && formData.exactLocation.lng !== '0') {
      import('mapbox-gl').then((mapboxModule) => {
        const mapboxgl = mapboxModule.default;
        createOrUpdateMarker(mapboxgl, formData.exactLocation.lng, formData.exactLocation.lat);
      });
    }
  }, [formData.exactLocation, mapInitialized]);

  // Function to search for locations using Mapbox Geocoding API
  const searchLocation = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?access_token=${MAPBOX_ACCESS_TOKEN}&country=AE&limit=5`
      );
      const data = await response.json();
      setSearchResults(data.features || []);
    } catch (error) {
      console.error('Error searching location:', error);
      setSearchResults([]);
    }
  };

  // Function to select a location from search results
  const selectLocation = (place: any) => {
    const [lng, lat] = place.center;
    setFormData(prev => ({
      ...prev,
      exactLocation: {
        lat: lat.toFixed(6),
        lng: lng.toFixed(6)
      },
      address: place.place_name
    }));
    
    if (mapInitialized) {
      import('mapbox-gl').then((mapboxModule) => {
        const mapboxgl = mapboxModule.default;
        createOrUpdateMarker(mapboxgl, lng, lat);
      });
    }
    
    setSearchResults([]);
    setSearchQuery('');
  };

  const handleOpenDialog = (place: LegalPlace | null = null) => {
    if (place) {
      setSelectedPlace(place);
      setFormData({
        name: place.name,
        specialistName: place.specialistName || '',
        whatsappNo: place.whatsappNo,
        status: place.status,
        operatingHours: place.operatingHours || { open: '09:00', close: '18:00' },
        exactLocation: {
          lat: place.exactLocation.lat.toString(),
          lng: place.exactLocation.lng.toString(),
        },
        address: place.address,
      });
    } else {
      setSelectedPlace(null);
      setFormData({
        name: '',
        specialistName: '',
        whatsappNo: '',
        status: 'ACTIVE',
        operatingHours: { open: '09:00', close: '18:00' },
        exactLocation: {
          lat: '25.276987',
          lng: '55.296249',
        },
        address: '',
      });
    }
    setMapInitialized(false);
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (place: LegalPlace) => {
    setSelectedPlace(place);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const url = '/api/appointments/appointment-places/legal';
      const method = selectedPlace ? 'PUT' : 'POST';
      
      const payload = {
        ...(selectedPlace && { id: selectedPlace.id }),
        name: formData.name,
        specialistName: formData.specialistName || null,
        whatsappNo: formData.whatsappNo,
        status: formData.status,
        operatingHours: formData.operatingHours,
        exactLocation: {
          lat: parseFloat(formData.exactLocation.lat),
          lng: parseFloat(formData.exactLocation.lng),
        },
        address: formData.address,
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
        throw new Error(errorData.error || 'Failed to save legal advisor');
      }

      toast({
        title: 'Success',
        description: `Legal advisor ${selectedPlace ? 'updated' : 'created'} successfully`,
      });

      setIsDialogOpen(false);
      fetchPlaces();
    } catch (error: any) {
      console.error('Error saving legal advisor:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save legal advisor',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!selectedPlace) return;

    try {
      const response = await fetch(`/api/appointments/appointment-places/legal?id=${selectedPlace.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete legal advisor');
      }

      toast({
        title: 'Success',
        description: 'Legal advisor deleted successfully',
      });

      setIsDeleteDialogOpen(false);
      fetchPlaces();
    } catch (error: any) {
      console.error('Error deleting legal advisor:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete legal advisor',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>;
      case 'INACTIVE':
        return <Badge variant="secondary" className="bg-red-100 text-red-800">Inactive</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  useEffect(() => {
    fetchPlaces();
  }, [statusFilter]);

  // Filter places based on search term
  const filteredPlaces = places.filter((place: any) =>
    place.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (
      Array.isArray(place.specialistNames)
        ? place.specialistNames.join(' ').toLowerCase().includes(searchTerm.toLowerCase())
        : (place.specialistName && place.specialistName.toLowerCase().includes(searchTerm.toLowerCase()))
    ) ||
    place.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Cleanup map on unmount
  useEffect(() => {
    return () => {
      if (mapboxMap.current) {
        mapboxMap.current.remove();
      }
    };
  }, []);

  // Open add dialog
  const openAddDialog = (place: LegalPlace) => {
    setAddTargetPlace(place);
    setAddSpecialistName('');
    setIsAddDialogOpen(true);
  };

  // Save add dialog
  const saveAddSpecialist = async () => {
    const place = addTargetPlace;
    if (!place) return;
    const trimmed = addSpecialistName.trim();
    if (!trimmed) return;

    const current = Array.isArray(place.specialistNames)
      ? place.specialistNames
      : (place.specialistName ? [place.specialistName] : []);

    const exists = current.some(s => s.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      toast({ title: 'Already exists', description: 'This specialist is already listed.' });
      return;
    }

    const payload = { id: place.id, specialistNames: [...current, trimmed] };
    try {
      const res = await fetch('/api/appointments/appointment-places/legal', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to add specialist');
      }
      toast({ title: 'Specialist added' });
      setIsAddDialogOpen(false);
      setAddTargetPlace(null);
      setAddSpecialistName('');
      fetchPlaces();
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Error', description: e.message || 'Failed to add specialist', variant: 'destructive' });
    }
  };

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Scale className="h-6 w-6 text-purple-600" />
              <div>
                <CardTitle>Legal Advisor Management</CardTitle>
                <CardDescription>Manage legal advisors and their appointments</CardDescription>
              </div>
            </div>
            <Button onClick={() => handleOpenDialog()} className="bg-purple-600 hover:bg-purple-700">
              <Plus className="h-4 w-4 mr-2" />
              Add Legal Advisor
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search legal advisors..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="text-center py-4">Loading legal advisors...</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Law Firm/Office Name</TableHead>
                    <TableHead>Specialists</TableHead>
                    <TableHead>Contact Info</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Operating Hours</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Consultations</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPlaces.map((place) => (
                    <TableRow key={place.id}>
                      <TableCell className="font-medium">{place.name}</TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground space-y-1">
                          {Array.isArray(place.specialistNames) && place.specialistNames.length > 0 ? (
                            place.specialistNames.map((s, idx) => (
                              <div key={idx}>{s}</div>
                            ))
                          ) : place.specialistName ? (
                            <div>{place.specialistName}</div>
                          ) : (
                            <div>-</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Phone className="h-4 w-4 mr-2 text-green-600" />
                          {place.whatsappNo}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <MapPin className="h-4 w-4 mr-2 text-red-500" />
                          <span className="truncate max-w-[200px]" title={place.address}>
                            {place.address}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {place.operatingHours?.open && place.operatingHours?.close
                          ? `${place.operatingHours.open} - ${place.operatingHours.close}`
                          : '-'}
                      </TableCell>
                      <TableCell>{getStatusBadge(place.status)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {place._count?.appointments || 0}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenDialog(place)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteClick(place)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="outline" size="sm" className="h-7 px-2 gap-1" onClick={() => openAddDialog(place)}>
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Add new specialist</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
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

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsDialogOpen(false);
          setFormData({
            name: '',
            specialistName: '',
            whatsappNo: '',
            status: 'ACTIVE',
            operatingHours: { open: '09:00', close: '18:00' },
            exactLocation: {
              lat: '25.276987',
              lng: '55.296249',
            },
            address: '',
          });
          setMapInitialized(false);
          setSearchQuery('');
          setSearchResults([]);
          if (mapboxMap.current) {
            mapboxMap.current.remove();
            mapboxMap.current = null;
          }
          if (markerRef.current) {
            markerRef.current = null;
          }
        }
      }}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-[95vw] h-[95vh] p-0 overflow-hidden">
          <form onSubmit={handleSubmit} className="flex h-full">
            {/* Left Sidebar with Form */}
            <div className="w-1/3 h-full flex flex-col border-r">
              <div className="p-6 pb-0 flex-shrink-0">
                <DialogHeader>
                  <DialogTitle className="flex items-center">
                    <Scale className="h-5 w-5 mr-2 text-purple-600" />
                    {selectedPlace ? 'Edit Legal Advisor' : 'Add New Legal Advisor'}
                  </DialogTitle>
                  <DialogDescription>
                    {selectedPlace ? 'Update the legal advisor details below.' : 'Fill in the details to add a new legal advisor.'}
                  </DialogDescription>
                </DialogHeader>
              </div>
              
              {/* Scrollable Form Content */}
              <div className="flex-grow overflow-y-auto p-6 pt-4" style={{ maxHeight: 'calc(95vh - 140px)' }}>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-medium">Law Firm/Office Name <span className="text-red-500">*</span></Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Law Firm/Office Name"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="specialistName" className="text-sm font-medium">Lawyer/Advisor Name</Label>
                    <Input
                      id="specialistName"
                      value={formData.specialistName}
                      onChange={(e) => setFormData({ ...formData, specialistName: e.target.value })}
                      placeholder="Lawyer/Advisor Name (Optional)"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="whatsappNo" className="text-sm font-medium">WhatsApp Number <span className="text-red-500">*</span></Label>
                    <Input
                      id="whatsappNo"
                      value={formData.whatsappNo}
                      onChange={(e) => setFormData({ ...formData, whatsappNo: e.target.value })}
                      placeholder="WhatsApp Number"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address" className="text-sm font-medium">Address <span className="text-red-500">*</span></Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Full Address"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lat" className="text-sm font-medium">Latitude</Label>
                    <Input
                      id="lat"
                      value={formData.exactLocation.lat}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        exactLocation: { ...formData.exactLocation, lat: e.target.value }
                      })}
                      placeholder="Click on map to set location"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lng" className="text-sm font-medium">Longitude</Label>
                    <Input
                      id="lng"
                      value={formData.exactLocation.lng}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        exactLocation: { ...formData.exactLocation, lng: e.target.value }
                      })}
                      placeholder="Click on map to set location"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Status <span className="text-red-500">*</span></Label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="status"
                          value="ACTIVE"
                          checked={formData.status === 'ACTIVE'}
                          onChange={(e) => setFormData({ ...formData, status: e.target.value as 'ACTIVE' | 'INACTIVE' })}
                          className="text-primary focus:ring-primary"
                        />
                        Active
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="status"
                          value="INACTIVE"
                          checked={formData.status === 'INACTIVE'}
                          onChange={(e) => setFormData({ ...formData, status: e.target.value as 'ACTIVE' | 'INACTIVE' })}
                          className="text-primary focus:ring-primary"
                        />
                        Inactive
                      </label>
                    </div>
                  </div>

                  

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Operating Hours</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="openTime" className="text-xs text-muted-foreground">Open</Label>
                        <Input
                          id="openTime"
                          type="time"
                          value={formData.operatingHours.open}
                          onChange={(e) => setFormData({ ...formData, operatingHours: { ...formData.operatingHours, open: e.target.value } })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="closeTime" className="text-xs text-muted-foreground">Close</Label>
                        <Input
                          id="closeTime"
                          type="time"
                          value={formData.operatingHours.close}
                          onChange={(e) => setFormData({ ...formData, operatingHours: { ...formData.operatingHours, close: e.target.value } })}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Fixed Footer with Buttons */}
              <div className="p-6 border-t bg-background">
                <DialogFooter className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-purple-600 hover:bg-purple-700">
                    {selectedPlace ? 'Update' : 'Create'} Legal Advisor
                  </Button>
                </DialogFooter>
              </div>
            </div>

            
            {/* Right Side Map */}
            <div className="w-2/3 h-full relative">
              {/* Map Search Controls */}
              <div className="absolute top-4 left-4 right-4 z-10 flex gap-2 items-center">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for a location..."
                  className="bg-white/90 backdrop-blur-sm"
                />
                <Button type="button" onClick={searchLocation}>Search</Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  className="bg-white/90 backdrop-blur-sm"
                  onClick={() => {
                    // Store current marker position if it exists
                    let markerPosition: [number, number] | null = null;
                    if (markerRef.current && mapboxMap.current) {
                      const lngLat = markerRef.current.getLngLat();
                      markerPosition = [lngLat.lng, lngLat.lat];
                    }
                    
                    // Toggle map style
                    const newStyle = mapStyle === 'standard' ? 'satellite-streets-v12' : 'standard';
                    setMapStyle(newStyle);
                    
                    // Update map style and restore marker after style loads
                    if (mapboxMap.current) {
                      mapboxMap.current.setStyle(`mapbox://styles/mapbox/${newStyle}`);
                      
                      mapboxMap.current.once('style.load', () => {
                        // Restore marker if we had one
                        if (markerPosition) {
                          import('mapbox-gl').then((mapboxModule) => {
                            const mapboxgl = mapboxModule.default;
                            createOrUpdateMarker(mapboxgl, markerPosition[0], markerPosition[1]);
                          });
                        }
                      });
                    }
                  }}
                  title={`Switch to ${mapStyle === 'standard' ? 'satellite' : 'standard'} view`}
                >
                  {mapStyle === 'standard' ? <Layers size={18} /> : <Map size={18} />}
                </Button>
              </div>
              
              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="absolute top-16 left-4 right-4 z-10 border rounded-md p-2 max-h-40 overflow-y-auto bg-white/90 backdrop-blur-sm">
                  {searchResults.map((place) => (
                    <div
                      key={place.place_id}
                      className="p-2 hover:bg-gray-100 cursor-pointer"
                      onClick={() => selectLocation(place)}
                    >
                      {place.display_name}
                    </div>
                  ))}
                </div>
              )}
              
              {/* Map Container */}
              <div 
                ref={mapRef} 
                className="h-full w-full" 
                style={{ position: 'relative' }}
              />
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Legal Advisor</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the legal advisor "{selectedPlace?.name}"?
              {selectedPlace && (selectedPlace._count?.appointments ?? 0) > 0 && (
                <div className="mt-2 text-destructive flex items-center">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  This legal advisor has {selectedPlace._count?.appointments} consultation(s) and cannot be deleted.
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
              disabled={(selectedPlace?._count?.appointments ?? 0) > 0}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Specialist Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add specialist</DialogTitle>
            <DialogDescription>Add a new lawyer/advisor for this firm.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <Label htmlFor="new-specialist">Name</Label>
            <Input id="new-specialist" value={addSpecialistName} onChange={(e) => setAddSpecialistName(e.target.value)} placeholder="e.g., Aisha Khan" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveAddSpecialist} disabled={!addSpecialistName.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
