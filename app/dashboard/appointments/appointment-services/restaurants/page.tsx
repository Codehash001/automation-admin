"use client";

import { useState, useEffect, useRef } from 'react';
import { Plus, Pencil, Trash2, Search, AlertCircle, Filter, MapPin, Clock, Layers, Map, UtensilsCrossed, User, Phone, Users } from 'lucide-react';
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

// Mapbox access token - you'll need to set this in your environment variables
const MAPBOX_ACCESS_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || 'your-mapbox-access-token-here';

interface RestaurantPlace {
  id: number;
  name: string;
  specialistName?: string; // legacy single value
  specialistNames?: string[]; // new array field
  whatsappNo: string;
  status: 'ACTIVE' | 'INACTIVE';
  exactLocation: {
    lat: number;
    lng: number;
  };
  address: string;
  numberOfAppointedPeople: number;
  _count?: {
    appointments: number;
  };
}

export default function RestaurantsPage() {
  const [places, setPlaces] = useState<RestaurantPlace[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<RestaurantPlace | null>(null);
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
    exactLocation: {
      lat: '25.276987',
      lng: '55.296249',
    },
    address: '',
    numberOfAppointedPeople: 2, // Default table size for restaurants
  });

  // Fetch restaurant places
  const fetchPlaces = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      
      const response = await fetch(`/api/appointments/appointment-places/restaurant?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch restaurants');
      
      const data = await response.json();
      setPlaces(data.places || []);
    } catch (error) {
      console.error('Error fetching restaurants:', error);
      toast({
        title: 'Error',
        description: 'Failed to load restaurants',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to create or update marker
  const createOrUpdateMarker = (mapboxgl: any, lng: number | string, lat: number | string) => {
    if (!mapboxMap.current) return;

    const lngNum = typeof lng === 'string' ? parseFloat(lng) : lng;
    const latNum = typeof lat === 'string' ? parseFloat(lat) : lat;

    if (isNaN(lngNum) || isNaN(latNum)) return;

    // Remove existing marker
    if (markerRef.current) {
      markerRef.current.remove();
    }

    // Create new marker
    markerRef.current = new mapboxgl.Marker({
      draggable: true,
      color: '#ea580c'
    })
      .setLngLat([lngNum, latNum])
      .addTo(mapboxMap.current);

    // Add drag event listeners
    markerRef.current.on('dragstart', () => {
      isDragging = true;
    });

    markerRef.current.on('dragend', () => {
      const lngLat = markerRef.current.getLngLat();
      setFormData(prev => ({
        ...prev,
        exactLocation: {
          lat: lngLat.lat.toFixed(6),
          lng: lngLat.lng.toFixed(6)
        }
      }));
      isDragging = false;
    });

    // Center map on marker
    if (!isDragging) {
      mapboxMap.current.setCenter([lngNum, latNum]);
    }
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

        mapboxMap.current.on('load', () => {
          setMapInitialized(true);
          
          // Add click event to place marker
          mapboxMap.current!.on('click', (e: any) => {
            if (!isDragging) {
              const { lng, lat } = e.lngLat;
              setFormData(prev => ({
                ...prev,
                exactLocation: {
                  lat: lat.toFixed(6),
                  lng: lng.toFixed(6)
                }
              }));
              createOrUpdateMarker(mapboxgl, lng, lat);
            }
          });

          // Create initial marker if coordinates exist and are not default Dubai coordinates
          if (formData.exactLocation.lat !== '25.276987' || formData.exactLocation.lng !== '55.296249') {
            createOrUpdateMarker(mapboxgl, formData.exactLocation.lng, formData.exactLocation.lat);
          }
        });

        mapboxMap.current.on('zoom', () => {
          if (mapboxMap.current) {
            currentZoomRef.current = mapboxMap.current.getZoom();
          }
        });
      });
    }, 100);

    return () => clearTimeout(timer);
  }, [isDialogOpen, mapInitialized, mapStyle]);

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

  const handleOpenDialog = (place: RestaurantPlace | null = null) => {
    if (place) {
      setSelectedPlace(place);
      setFormData({
        name: place.name,
        specialistName: place.specialistName || '',
        whatsappNo: place.whatsappNo,
        status: place.status,
        exactLocation: {
          lat: place.exactLocation.lat.toString(),
          lng: place.exactLocation.lng.toString(),
        },
        address: place.address,
        numberOfAppointedPeople: place.numberOfAppointedPeople,
      });
    } else {
      setSelectedPlace(null);
      setFormData({
        name: '',
        specialistName: '',
        whatsappNo: '',
        status: 'ACTIVE',
        exactLocation: {
          lat: '25.276987',
          lng: '55.296249',
        },
        address: '',
        numberOfAppointedPeople: 2, // Default table size for restaurants
      });
    }
    setMapInitialized(false);
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (place: RestaurantPlace) => {
    setSelectedPlace(place);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const url = '/api/appointments/appointment-places/restaurant';
      const method = selectedPlace ? 'PUT' : 'POST';
      
      const payload = {
        ...(selectedPlace && { id: selectedPlace.id }),
        name: formData.name,
        specialistName: formData.specialistName || null,
        whatsappNo: formData.whatsappNo,
        status: formData.status,
        exactLocation: {
          lat: parseFloat(formData.exactLocation.lat),
          lng: parseFloat(formData.exactLocation.lng),
        },
        address: formData.address,
        numberOfAppointedPeople: formData.numberOfAppointedPeople,
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
        throw new Error(errorData.error || 'Failed to save restaurant');
      }

      toast({
        title: 'Success',
        description: `Restaurant ${selectedPlace ? 'updated' : 'created'} successfully`,
      });

      setIsDialogOpen(false);
      fetchPlaces();
    } catch (error: any) {
      console.error('Error saving restaurant:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save restaurant',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!selectedPlace) return;

    try {
      const response = await fetch(`/api/appointments/appointment-places/restaurant?id=${selectedPlace.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete restaurant');
      }

      toast({
        title: 'Success',
        description: 'Restaurant deleted successfully',
      });

      setIsDeleteDialogOpen(false);
      fetchPlaces();
    } catch (error: any) {
      console.error('Error deleting restaurant:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete restaurant',
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

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <UtensilsCrossed className="h-6 w-6 text-orange-600" />
              <div>
                <CardTitle>Restaurant Management</CardTitle>
                <CardDescription>Manage restaurants and their reservations</CardDescription>
              </div>
            </div>
            <Button onClick={() => handleOpenDialog()} className="bg-orange-600 hover:bg-orange-700">
              <Plus className="h-4 w-4 mr-2" />
              Add Restaurant
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
                  placeholder="Search restaurants..."
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
            <div className="text-center py-4">Loading restaurants...</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Restaurant Name</TableHead>
                    <TableHead>Contact Info</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Table Size</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reservations</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPlaces.map((place) => (
                    <TableRow key={place.id}>
                      <TableCell className="font-medium">{place.name}</TableCell>
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
                        <div className="flex items-center">
                          <Users className="h-4 w-4 mr-2 text-blue-500" />
                          <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                            {place.numberOfAppointedPeople} people
                          </Badge>
                        </div>
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
            exactLocation: {
              lat: '25.276987',
              lng: '55.296249',
            },
            address: '',
            numberOfAppointedPeople: 2,
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
                    <UtensilsCrossed className="h-5 w-5 mr-2 text-orange-600" />
                    {selectedPlace ? 'Edit Restaurant' : 'Add New Restaurant'}
                  </DialogTitle>
                  <DialogDescription>
                    {selectedPlace ? 'Update the restaurant details below.' : 'Fill in the details to add a new restaurant.'}
                  </DialogDescription>
                </DialogHeader>
              </div>
              
              {/* Scrollable Form Content */}
              <div className="flex-grow overflow-y-auto p-6 pt-4" style={{ maxHeight: 'calc(95vh - 140px)' }}>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-medium">Restaurant Name <span className="text-red-500">*</span></Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Restaurant Name"
                      required
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
                    <Label htmlFor="numberOfAppointedPeople" className="text-sm font-medium">Default Table Size <span className="text-red-500">*</span></Label>
                    <Input
                      id="numberOfAppointedPeople"
                      type="number"
                      min="1"
                      max="20"
                      value={formData.numberOfAppointedPeople}
                      onChange={(e) => setFormData({ ...formData, numberOfAppointedPeople: parseInt(e.target.value) || 2 })}
                      placeholder="Number of people"
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
                </div>
              </div>
              
              {/* Fixed Footer with Buttons */}
              <div className="p-6 border-t bg-background">
                <DialogFooter className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-orange-600 hover:bg-orange-700">
                    {selectedPlace ? 'Update' : 'Create'} Restaurant
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
            <DialogTitle>Delete Restaurant</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the restaurant "{selectedPlace?.name}"?
              {selectedPlace && (selectedPlace._count?.appointments ?? 0) > 0 && (
                <div className="mt-2 text-destructive flex items-center">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  This restaurant has {selectedPlace._count?.appointments} reservation(s) and cannot be deleted.
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
    </div>
  );
}
