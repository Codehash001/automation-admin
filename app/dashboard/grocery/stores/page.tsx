"use client";

import { useState, useEffect, useRef } from 'react';
import { Plus, Pencil, Trash2, Search, AlertCircle, Filter, MapPin, Clock, Layers, Map } from 'lucide-react';
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

interface GroceryStore {
  id: number;
  name: string;
  whatsappNo: string;
  status: 'OPEN' | 'BUSY' | 'CLOSED';
  exactLocation: {
    lat: number;
    lng: number;
  };
  operatingHours: {
    open: string;
    close: string;
  };
  emirates: {
    id: number;
    name: string;
  };
  _count?: {
    menus: number;
    orders: number;
  };
}

interface Emirates {
  id: number;
  name: string;
}

export default function GroceryStorePage() {
  const [stores, setStores] = useState<GroceryStore[]>([]);
  const [emirates, setEmirates] = useState<Emirates[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedStore, setSelectedStore] = useState<GroceryStore | null>(null);
  const [selectedEmirate, setSelectedEmirate] = useState<string>('all');
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
    emiratesId: '',
    whatsappNo: '',
    status: 'CLOSED' as 'OPEN' | 'BUSY' | 'CLOSED',
    exactLocation: {
      lat: '0',
      lng: '0',
    },
    operatingHours: {
      open: '09:00',
      close: '21:00',
    },
  });

  // Fetch stores
  const fetchStores = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedEmirate) params.append('emirateId', selectedEmirate);
      
      const response = await fetch(`/api/grocery/store?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch grocery stores');
      
      const data = await response.json();
      setStores(data);
    } catch (error) {
      console.error('Error fetching grocery stores:', error);
      toast({
        title: 'Error',
        description: 'Failed to load grocery stores',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch emirates for filters
  const fetchEmirates = async () => {
    try {
      const response = await fetch('/api/emirates');
      if (!response.ok) throw new Error('Failed to fetch emirates');
      
      const data = await response.json();
      setEmirates(data);
    } catch (error) {
      console.error('Error fetching emirates:', error);
    }
  };

  useEffect(() => {
    fetchStores();
    fetchEmirates();
  }, [selectedEmirate]);

  const filteredStores = stores.filter(store => 
    store.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    store.emirates.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Initialize map when dialog opens
  useEffect(() => {
    if (!isDialogOpen) {
      // Clean up map when dialog closes
      if (typeof window !== 'undefined' && mapboxMap.current) {
        mapboxMap.current.remove();
        mapboxMap.current = null;
        markerRef.current = null;
      }
      setSearchQuery('');
      setSearchResults([]);
      return;
    }

    // Only run on client side
    if (typeof window === 'undefined') return;

    // Initialize map after a short delay to ensure DOM is ready
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

  // Helper function to create or update marker
  const createOrUpdateMarker = (mapboxgl: any, lng: number | string, lat: number | string) => {
    if (!mapboxMap.current) return;
    
    const lngNum = typeof lng === 'string' ? parseFloat(lng) : lng;
    const latNum = typeof lat === 'string' ? parseFloat(lat) : lat;
    
    if (isNaN(lngNum) || isNaN(latNum)) return;
    
    // Remove old marker if it exists
    if (markerRef.current) {
      markerRef.current.remove();
    }
    
    // Add new marker
    markerRef.current = new mapboxgl.Marker({ draggable: true })
      .setLngLat([lngNum, latNum])
      .addTo(mapboxMap.current);
    
    // Keep current zoom level when updating center
    if (mapboxMap.current && !isDragging) {
      mapboxMap.current.setCenter([lngNum, latNum]);
    }
    
    // Add drag event listeners
    if (markerRef.current) {
      markerRef.current.on('dragstart', () => {
        isDragging = true;
      });
      
      markerRef.current.on('dragend', () => {
        const lngLat = markerRef.current!.getLngLat();
        const newLat = lngLat.lat.toFixed(6);
        const newLng = lngLat.lng.toFixed(6);
        
        setFormData(prev => ({
          ...prev,
          exactLocation: { lat: newLat, lng: newLng }
        }));
        
        // Set isDragging to false after a short delay to prevent zoom reset
        setTimeout(() => {
          isDragging = false;
        }, 50);
      });
    }
  };

  // Update map marker when location changes from input fields
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;
    
    if (!mapboxMap.current || !formData.exactLocation.lat || !formData.exactLocation.lng) return;

    const lat = parseFloat(formData.exactLocation.lat);
    const lng = parseFloat(formData.exactLocation.lng);

    if (isNaN(lat) || isNaN(lng)) return;

    // Don't update during drag operations
    if (isDragging) return;

    // Import mapbox-gl dynamically
    import('mapbox-gl').then((mapboxModule) => {
      createOrUpdateMarker(mapboxModule.default, lng, lat);
    });
  }, [formData.exactLocation]);

  // Function to search for locations using Mapbox Geocoding API
  const searchLocation = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?access_token=${MAPBOX_ACCESS_TOKEN}&limit=5&country=ae&proximity=55.296249,25.276987`
      );
      const data = await response.json();
      
      if (data.features) {
        // Transform Mapbox response to match our expected format
        const transformedResults = data.features.map((feature: any) => ({
          place_id: feature.id,
          display_name: feature.place_name,
          lat: feature.center[1].toString(),
          lon: feature.center[0].toString(),
        }));
        setSearchResults(transformedResults);
      }
    } catch (error) {
      console.error('Error searching for location:', error);
      toast({
        title: 'Error',
        description: 'Failed to search for location',
        variant: 'destructive',
      });
    }
  };

  // Function to select a location from search results
  const selectLocation = (place: any) => {
    if (!place.lat || !place.lon) return;
    
    setFormData(prev => ({
      ...prev,
      exactLocation: {
        lat: place.lat,
        lng: place.lon,
      }
    }));
    
    setSearchResults([]);
    setSearchQuery('');
    
    // Import mapbox-gl dynamically
    if (typeof window !== 'undefined') {
      import('mapbox-gl').then((mapboxModule) => {
        createOrUpdateMarker(mapboxModule.default, place.lon, place.lat);
      });
    }
  };

  const handleOpenDialog = (store: GroceryStore | null = null) => {
    if (store) {
      setSelectedStore(store);
      setFormData({
        name: store.name,
        emiratesId: store.emirates.id.toString(),
        whatsappNo: store.whatsappNo,
        status: store.status,
        exactLocation: {
          lat: store.exactLocation.lat.toString(),
          lng: store.exactLocation.lng.toString(),
        },
        operatingHours: {
          open: store.operatingHours.open,
          close: store.operatingHours.close,
        },
      });
    } else {
      setSelectedStore(null);
      setFormData({
        name: '',
        emiratesId: '',
        whatsappNo: '',
        status: 'CLOSED',
        exactLocation: {
          lat: '25.276987',
          lng: '55.296249',
        },
        operatingHours: {
          open: '09:00',
          close: '21:00',
        },
      });
    }
    
    // Reset map state
    setMapInitialized(false);
    setSearchQuery('');
    setSearchResults([]);
    
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (store: GroceryStore) => {
    setSelectedStore(store);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Validate required fields
      if (!formData.name || !formData.emiratesId || !formData.whatsappNo) {
        toast({
          title: 'Validation Error',
          description: 'Please fill in all required fields',
          variant: 'destructive',
        });
        return;
      }

      const storeData = {
        name: formData.name,
        emiratesId: parseInt(formData.emiratesId),
        whatsappNo: formData.whatsappNo,
        status: formData.status,
        exactLocation: {
          lat: parseFloat(formData.exactLocation.lat),
          lng: parseFloat(formData.exactLocation.lng),
        },
        operatingHours: {
          open: formData.operatingHours.open,
          close: formData.operatingHours.close,
        },
      };

      const url = selectedStore
        ? `/api/grocery/store?id=${selectedStore.id}`
        : '/api/grocery/store';
      
      const method = selectedStore ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(storeData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save store');
      }

      toast({
        title: 'Success',
        description: selectedStore
          ? 'Grocery store updated successfully'
          : 'Grocery store created successfully',
      });

      setIsDialogOpen(false);
      fetchStores();
    } catch (error) {
      console.error('Error saving grocery store:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save grocery store',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!selectedStore) return;
    
    try {
      const response = await fetch(`/api/grocery/store?id=${selectedStore.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete store');
      }

      toast({
        title: 'Success',
        description: 'Grocery store deleted successfully',
      });

      setIsDeleteDialogOpen(false);
      fetchStores();
    } catch (error) {
      console.error('Error deleting grocery store:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete grocery store',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return <Badge className="bg-green-500">Open</Badge>;
      case 'BUSY':
        return <Badge className="bg-yellow-500">Busy</Badge>;
      case 'CLOSED':
        return <Badge className="bg-red-500">Closed</Badge>;
      default:
        return <Badge className="bg-gray-500">Unknown</Badge>;
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Grocery Stores</h1>
        <Button onClick={() => handleOpenDialog(null)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Store
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter and search grocery stores</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search stores..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="w-full md:w-[200px]">
              <Select
                value={selectedEmirate}
                onValueChange={setSelectedEmirate}
              >
                <SelectTrigger>
                  <div className="flex items-center">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter by Emirate" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Emirates</SelectItem>
                  {emirates.map((emirate) => (
                    <SelectItem key={emirate.id} value={emirate.id.toString()}>
                      {emirate.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-4">Loading stores...</div>
          ) : filteredStores.length === 0 ? (
            <div className="text-center py-4">No grocery stores found</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Emirate</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Menus</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStores.map((store) => (
                    <TableRow key={store.id}>
                      <TableCell className="font-medium">{store.name}</TableCell>
                      <TableCell>{store.emirates.name}</TableCell>
                      <TableCell>{store.whatsappNo}</TableCell>
                      <TableCell>{getStatusBadge(store.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <MapPin className="h-3 w-3 mr-1" />
                          <span className="text-xs">
                            {store.exactLocation.lat.toFixed(4)}, {store.exactLocation.lng.toFixed(4)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          <span className="text-xs">
                            {store.operatingHours.open} - {store.operatingHours.close}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{store._count?.menus || 0}</TableCell>
                      <TableCell>{store._count?.orders || 0}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(store)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => handleDeleteClick(store)}
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
            emiratesId: '',
            whatsappNo: '',
            status: 'CLOSED',
            exactLocation: {
              lat: '25.276987',
              lng: '55.296249',
            },
            operatingHours: {
              open: '09:00',
              close: '21:00',
            },
          });
        }
      }}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-[95vw] h-[95vh] p-0 overflow-hidden">
          <form onSubmit={handleSubmit} className="flex h-full">
            {/* Left Sidebar with Form */}
            <div className="w-1/3 h-full flex flex-col border-r">
              <div className="p-6 pb-0 flex-shrink-0">
                <DialogHeader>
                  <DialogTitle>{selectedStore ? 'Edit Grocery Store' : 'Add New Grocery Store'}</DialogTitle>
                  <DialogDescription>
                    {selectedStore
                      ? 'Update the details of the grocery store'
                      : 'Add a new grocery store to the system'}
                  </DialogDescription>
                </DialogHeader>
              </div>
              
              {/* Scrollable Form Content */}
              <div className="flex-grow overflow-y-auto p-6 pt-4" style={{ maxHeight: 'calc(95vh - 140px)' }}>
                <div className="space-y-4">
                  {/* Store Name */}
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-medium">Store Name <span className="text-red-500">*</span></Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="Store Name"
                      required
                    />
                  </div>

                  {/* Emirates Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="emirate" className="text-sm font-medium">Emirate <span className="text-red-500">*</span></Label>
                    <Select
                      value={formData.emiratesId}
                      onValueChange={(value) =>
                        setFormData({ ...formData, emiratesId: value })
                      }
                      required
                    >
                      <SelectTrigger id="emirate">
                        <SelectValue placeholder="Select Emirate" />
                      </SelectTrigger>
                      <SelectContent>
                        {emirates.map((emirate) => (
                          <SelectItem
                            key={emirate.id}
                            value={emirate.id.toString()}
                          >
                            {emirate.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* WhatsApp Number */}
                  <div className="space-y-2">
                    <Label htmlFor="whatsapp" className="text-sm font-medium">WhatsApp Number <span className="text-red-500">*</span></Label>
                    <Input
                      id="whatsapp"
                      value={formData.whatsappNo}
                      onChange={(e) =>
                        setFormData({ ...formData, whatsappNo: e.target.value })
                      }
                      placeholder="WhatsApp Number"
                      required
                    />
                  </div>

                  {/* Exact Location Fields */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Exact Location (Lat, Lng - Please choose from the map) <span className="text-red-500">*</span></label>
                    <div className="flex gap-2 items-center">
                      <Input
                        name="latitude"
                        value={formData.exactLocation.lat}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            exactLocation: {
                              ...formData.exactLocation,
                              lat: e.target.value,
                            },
                          })
                        }
                        placeholder="Latitude"
                        required
                      />
                      <Input
                        name="longitude"
                        value={formData.exactLocation.lng}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            exactLocation: {
                              ...formData.exactLocation,
                              lng: e.target.value,
                            },
                          })
                        }
                        placeholder="Longitude"
                        required
                      />
                    </div>
                  </div>

                  {/* Operating Hours */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Operating Hours <span className="text-red-500">*</span></Label>
                    <div className="flex gap-2 items-center">
                      <div className="flex-1">
                        <label className="text-xs text-muted-foreground">Open Time</label>
                        <Input
                          id="openTime"
                          type="time"
                          value={formData.operatingHours.open}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              operatingHours: {
                                ...formData.operatingHours,
                                open: e.target.value,
                              },
                            })
                          }
                          required
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs text-muted-foreground">Close Time</label>
                        <Input
                          id="closeTime"
                          type="time"
                          value={formData.operatingHours.close}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              operatingHours: {
                                ...formData.operatingHours,
                                close: e.target.value,
                              },
                            })
                          }
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="space-y-2">
                    <Label htmlFor="status" className="text-sm font-medium">Status <span className="text-red-500">*</span></Label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={formData.status === 'OPEN'}
                          onChange={() => setFormData({ ...formData, status: 'OPEN' })}
                          className="text-primary focus:ring-primary"
                        />
                        OPEN
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={formData.status === 'BUSY'}
                          onChange={() => setFormData({ ...formData, status: 'BUSY' })}
                          className="text-primary focus:ring-primary"
                        />
                        BUSY
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={formData.status === 'CLOSED'}
                          onChange={() => setFormData({ ...formData, status: 'CLOSED' })}
                          className="text-primary focus:ring-primary"
                        />
                        CLOSED
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
                  <Button type="submit">
                    {selectedStore ? 'Update Store' : 'Create Store'}
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
            <DialogTitle>Delete Grocery Store</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the grocery store "{selectedStore?.name}"?
              {selectedStore && (selectedStore._count?.menus ?? 0) > 0 && (
                <div className="mt-2 text-destructive flex items-center">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  This store has {selectedStore._count?.menus} menu(s) and cannot be deleted.
                </div>
              )}
              {selectedStore && (selectedStore._count?.orders ?? 0) > 0 && (
                <div className="mt-2 text-destructive flex items-center">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  This store has {selectedStore._count?.orders} order(s) and cannot be deleted.
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
              disabled={
                (selectedStore?._count?.menus ?? 0) > 0 ||
                (selectedStore?._count?.orders ?? 0) > 0
              }
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
