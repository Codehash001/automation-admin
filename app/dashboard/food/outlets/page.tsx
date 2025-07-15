"use client";

import { useState, useEffect, useRef } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import 'mapbox-gl/dist/mapbox-gl.css';

// Mapbox access token - you'll need to set this in your environment variables
const MAPBOX_ACCESS_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || 'your-mapbox-access-token-here';

// Minimal Custom Time Picker Component
const CustomTimePicker = ({ value, onChange, className, required }: { value: string; onChange: (value: string) => void; className?: string; required?: boolean }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hours, setHours] = useState(value ? value.split(':')[0] : '00');
  const [minutes, setMinutes] = useState(value ? value.split(':')[1] : '00');

  useEffect(() => {
    if (value) {
      const [h, m] = value.split(':');
      setHours(h || '00');
      setMinutes(m || '00');
    }
  }, [value]);

  const handleSelect = (h: string, m: string) => {
    const newTime = `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
    onChange(newTime);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className || ''}`}>
      <Input
        value={`${hours}:${minutes}`}
        onChange={() => {}} // Prevent direct typing, only selection
        onClick={() => setIsOpen(true)}
        className="cursor-pointer"
        readOnly
        required={required}
      />
      {isOpen && (
        <div className="absolute z-50 bg-background border rounded-md shadow-lg p-2 mt-1 w-32">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Hours</label>
              <Select value={hours} onValueChange={(val) => setHours(val)}>
                <SelectTrigger className="w-full text-sm p-1 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-40">
                  {Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0')).map((h) => (
                    <SelectItem key={h} value={h}>{h}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Minutes</label>
              <Select value={minutes} onValueChange={(val) => setMinutes(val)}>
                <SelectTrigger className="w-full text-sm p-1 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-40">
                  {Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0')).map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button 
            size="sm" 
            className="mt-2 w-full" 
            onClick={() => handleSelect(hours, minutes)}
          >
            Set
          </Button>
        </div>
      )}
    </div>
  );
};

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
  exactLocation: {
    lat: string;
    lng: string;
  };
  operatingHours: {
    open: string;
    close: string;
  };
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
    exactLocation: {
      lat: '',
      lng: '',
    },
    operatingHours: {
      open: '',
      close: '',
    },
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const mapRef = useRef<HTMLDivElement>(null);
  const mapboxMap = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [mapInitialized, setMapInitialized] = useState(false); // Track if map is initialized

  useEffect(() => {
    if (typeof window !== 'undefined' && mapRef.current && !mapInitialized) {
      const initializeMap = () => {
        // Dynamically import Mapbox GL JS to prevent SSR issues
        import('mapbox-gl').then((mapboxModule) => {
          if (!mapRef.current) return;
          
          // Access the default export and set the access token
          const mapboxgl = mapboxModule.default;
          mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
          
          mapboxMap.current = new mapboxgl.Map({
            container: mapRef.current,
            style: 'mapbox://styles/mapbox/streets-v11',
            center: [55.296249, 25.276987],
            zoom: 13,
          });

          // Force map to resize after a short delay
          setTimeout(() => {
            if (mapboxMap.current) {
              mapboxMap.current.resize();
            }
          }, 100);

          setMapInitialized(true);
        });
      };

      // Initialize map directly since CSS is now statically imported
      initializeMap();
    }

    return () => {
      if (mapboxMap.current) {
        mapboxMap.current.remove();
        mapboxMap.current = null;
        setMapInitialized(false);
      }
    };
  }, []);

  useEffect(() => {
    if (selectedOutlet) {
      setFormData({
        name: selectedOutlet.name,
        emiratesId: selectedOutlet.emirates.id.toString(),
        cuisineIds: selectedOutlet.cuisines.map(c => c.cuisine.id.toString()),
        whatsappNo: selectedOutlet.whatsappNo,
        status: selectedOutlet.status,
        exactLocation: selectedOutlet.exactLocation || { lat: '', lng: '' },
        operatingHours: selectedOutlet.operatingHours || { open: '', close: '' },
      });
    } else {
      resetForm();
    }
  }, [selectedOutlet]);

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
      if (!mapRef.current || mapboxMap.current) return;

      // Dynamically import Mapbox GL JS to prevent SSR issues
      import('mapbox-gl').then((mapboxModule) => {
        // Double-check that mapRef.current is still available
        if (!mapRef.current) return;
        
        // Access the default export and set the access token
        const mapboxgl = mapboxModule.default;
        mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
        
        // Initialize the Mapbox GL JS map
        mapboxMap.current = new mapboxgl.Map({
          container: mapRef.current,
          style: 'mapbox://styles/mapbox/streets-v11',
          center: [55.2708, 25.2048],
          zoom: 10,
        });
        
        // Add click event to place marker
        mapboxMap.current.on('click', function (e: any) {
          const lat = e.lngLat.lat.toFixed(6);
          const lng = e.lngLat.lng.toFixed(6);

          setFormData(prev => ({
            ...prev,
            exactLocation: { lat, lng }
          }));

          // Remove old marker if it exists
          if (markerRef.current) {
            markerRef.current.remove();
          }

          // Add new marker
          if (mapboxMap.current) {
            markerRef.current = new mapboxgl.Marker({ draggable: true })
              .setLngLat([lng, lat])
              .addTo(mapboxMap.current);
            if (mapboxMap.current) {
              const currentZoom = mapboxMap.current.getZoom() || 13;
              mapboxMap.current.setZoom(currentZoom);
              mapboxMap.current.setCenter([lng, lat]);
            }

            // Add drag event listener to update form data when marker is dragged
            if (markerRef.current) {
              markerRef.current.on('dragend', function () {
                const lngLat = markerRef.current!.getLngLat();
                const newLat = lngLat.lat.toFixed(6);
                const newLng = lngLat.lng.toFixed(6);
                setFormData(prev => ({
                  ...prev,
                  exactLocation: { lat: newLat, lng: newLng }
                }));
              });
            }
          }
        });

        // Add marker if location already exists
        if (formData.exactLocation.lat && formData.exactLocation.lng) {
          const lat = parseFloat(formData.exactLocation.lat);
          const lng = parseFloat(formData.exactLocation.lng);
          if (!isNaN(lat) && !isNaN(lng)) {
            if (mapboxMap.current) {
              markerRef.current = new mapboxgl.Marker({ draggable: true })
                .setLngLat([lng, lat])
                .addTo(mapboxMap.current);
              if (mapboxMap.current) {
                const currentZoom = mapboxMap.current.getZoom() || 13;
                mapboxMap.current.setZoom(currentZoom);
                mapboxMap.current.setCenter([lng, lat]);
              }

              // Add drag event listener to update form data when marker is dragged
              if (markerRef.current) {
                markerRef.current.on('dragend', function () {
                  const lngLat = markerRef.current!.getLngLat();
                  const newLat = lngLat.lat.toFixed(6);
                  const newLng = lngLat.lng.toFixed(6);
                  setFormData(prev => ({
                    ...prev,
                    exactLocation: { lat: newLat, lng: newLng }
                  }));
                });
              }
            }
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
  }, [isDialogOpen, formData.exactLocation]);

  // Update map marker when location changes
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;
    
    if (!mapboxMap.current || !formData.exactLocation.lat || !formData.exactLocation.lng) return;

    const lat = parseFloat(formData.exactLocation.lat);
    const lng = parseFloat(formData.exactLocation.lng);

    if (isNaN(lat) || isNaN(lng)) return;

    if (markerRef.current) {
      markerRef.current.setLngLat([lng, lat]);
    } else {
      // Dynamically import Mapbox GL JS to prevent SSR issues
      import('mapbox-gl').then((mapboxModule) => {
        // Access the default export
        const mapboxgl = mapboxModule.default;
        
        if (mapboxMap.current) {
          markerRef.current = new mapboxgl.Marker({ draggable: true })
            .setLngLat([lng, lat])
            .addTo(mapboxMap.current);
          if (mapboxMap.current) {
            const currentZoom = mapboxMap.current.getZoom() || 13;
            mapboxMap.current.setZoom(currentZoom);
            mapboxMap.current.setCenter([lng, lat]);
          }

          // Add drag event listener to update form data when marker is dragged
          if (markerRef.current) {
            markerRef.current.on('dragend', function () {
              const lngLat = markerRef.current!.getLngLat();
              const newLat = lngLat.lat.toFixed(6);
              const newLng = lngLat.lng.toFixed(6);
              setFormData(prev => ({
                ...prev,
                exactLocation: { lat: newLat, lng: newLng }
              }));
            });
          }
        }
      });
    }
    if (mapboxMap.current) {
      const currentZoom = mapboxMap.current.getZoom() || 13;
      mapboxMap.current.setZoom(currentZoom);
      mapboxMap.current.setCenter([lng, lat]);
    }
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
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching location:', error);
      setSearchResults([]);
      toast({
        title: 'Error',
        description: 'Failed to search for location. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Function to select a location from search results
  const selectLocation = (place: any) => {
    // Only run on client side
    if (typeof window === 'undefined') return;
    
    const lat = parseFloat(place.lat).toFixed(6);
    const lng = parseFloat(place.lon).toFixed(6);

    setFormData(prev => ({
      ...prev,
      exactLocation: { lat, lng }
    }));

    // Remove old marker if it exists
    if (markerRef.current) {
      markerRef.current.remove();
    }

    // Add new marker
    import('mapbox-gl').then((mapboxModule) => {
      // Access the default export
      const mapboxgl = mapboxModule.default;
      
      if (mapboxMap.current) {
        if (!markerRef.current) {
          markerRef.current = new mapboxgl.Marker({ draggable: true })
            .setLngLat([parseFloat(lng), parseFloat(lat)])
            .addTo(mapboxMap.current);
        } else {
          markerRef.current.setLngLat([parseFloat(lng), parseFloat(lat)]);
        }
        if (mapboxMap.current) {
          const currentZoom = mapboxMap.current.getZoom() || 13;
          mapboxMap.current.setZoom(currentZoom);
          mapboxMap.current.setCenter([parseFloat(lng), parseFloat(lat)]);
        }

        // Add drag event listener to update form data when marker is dragged
        if (markerRef.current) {
          markerRef.current.on('dragend', function () {
            const lngLat = markerRef.current!.getLngLat();
            const newLat = lngLat.lat.toFixed(6);
            const newLng = lngLat.lng.toFixed(6);
            setFormData(prev => ({
              ...prev,
              exactLocation: { lat: newLat, lng: newLng }
            }));
          });
        }
      }
    });

    // Clear search results
    setSearchQuery('');
    setSearchResults([]);
  };

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
      exactLocation: {
        lat: '',
        lng: '',
      },
      operatingHours: {
        open: '',
        close: '',
      },
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
      exactLocation: outlet.exactLocation || { lat: '', lng: '' },
      operatingHours: outlet.operatingHours || { open: '', close: '' },
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

    if (!formData.exactLocation.lat || !formData.exactLocation.lng) {
      toast({
        title: 'Error',
        description: 'Please enter the exact location',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.operatingHours.open || !formData.operatingHours.close) {
      toast({
        title: 'Error',
        description: 'Please enter the operating hours',
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
        exactLocation: {
          lat: parseFloat(formData.exactLocation.lat),
          lng: parseFloat(formData.exactLocation.lng),
        },
        operatingHours: {
          open: formData.operatingHours.open,
          close: formData.operatingHours.close,
        },
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
              <TableHead>Location (Lat, Lng)</TableHead>
              <TableHead>Operating Hours</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  Loading outlets...
                </TableCell>
              </TableRow>
            ) : filteredOutlets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
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
                  <TableCell className="max-w-[150px] truncate">
                    {outlet.exactLocation && outlet.exactLocation.lat && outlet.exactLocation.lng ? (
                      <a 
                        href={`https://www.google.com/maps?q=${outlet.exactLocation.lat},${outlet.exactLocation.lng}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline"
                      >
                        {outlet.exactLocation.lat}, {outlet.exactLocation.lng}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">Not set</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {outlet.operatingHours ? `${outlet.operatingHours.open} - ${outlet.operatingHours.close}` : 'N/A'}
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
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{selectedOutlet ? 'Edit Outlet' : 'Add New Outlet'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Outlet Name */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Outlet Name <span className="text-red-500">*</span></label>
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
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Emirate <span className="text-red-500">*</span></label>
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

              {/* WhatsApp Number */}
              <div className="space-y-2">
                <label className="text-sm font-medium">WhatsApp Number <span className="text-red-500">*</span></label>
                <Input
                  name="whatsappNo"
                  value={formData.whatsappNo}
                  onChange={handleInputChange}
                  placeholder="+971xxxxxxxxx"
                  required
                />
              </div>

              {/* Map for Location Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Exact Location (Lat, Lng) <span className="text-red-500">*</span></label>
                <div className="flex gap-2 items-center mb-2">
                  <Input
                    name="exactLocation.lat"
                    value={formData.exactLocation.lat}
                    onChange={handleInputChange}
                    placeholder="Latitude"
                    required
                  />
                  <Input
                    name="exactLocation.lng"
                    value={formData.exactLocation.lng}
                    onChange={handleInputChange}
                    placeholder="Longitude"
                    required
                  />
                </div>
                <div className="flex gap-2 items-center mb-2">
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search for a location..."
                  />
                  <Button type="button" onClick={searchLocation}>Search</Button>
                </div>
                {searchResults.length > 0 && (
                  <div className="border rounded-md p-2 max-h-40 overflow-y-auto mb-2">
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
                <div 
                  ref={mapRef} 
                  className="h-64 w-full rounded-md border border-gray-200 overflow-hidden" 
                  style={{ minHeight: '256px', position: 'relative' }}
                />
                <p className="text-xs text-muted-foreground">Click on the map to set the outlet location</p>
              </div>

              {/* Operating Hours */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Operating Hours <span className="text-red-500">*</span></label>
                <div className="flex gap-2 items-center">
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground">Open Time</label>
                    <CustomTimePicker
                      value={formData.operatingHours.open}
                      onChange={(value) => setFormData(prev => ({ ...prev, operatingHours: { ...prev.operatingHours, open: value } }))}
                      className="w-full"
                      required
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground">Close Time</label>
                    <CustomTimePicker
                      value={formData.operatingHours.close}
                      onChange={(value) => setFormData(prev => ({ ...prev, operatingHours: { ...prev.operatingHours, close: value } }))}
                      className="w-full"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={formData.status === 'OPEN'}
                      onChange={() => handleSelectChange('status', 'OPEN')}
                      className="text-primary focus:ring-primary"
                    />
                    OPEN
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={formData.status === 'BUSY'}
                      onChange={() => handleSelectChange('status', 'BUSY')}
                      className="text-primary focus:ring-primary"
                    />
                    BUSY
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={formData.status === 'CLOSED'}
                      onChange={() => handleSelectChange('status', 'CLOSED')}
                      className="text-primary focus:ring-primary"
                    />
                    CLOSED
                  </label>
                </div>
              </div>

              {/* Cuisines */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Cuisines <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-[200px] overflow-y-auto p-1 border rounded-md bg-background">
                  {cuisines.map((cuisine) => (
                    <label key={cuisine.id} className="flex items-center gap-2 cursor-pointer truncate">
                      <input
                        type="checkbox"
                        checked={formData.cuisineIds.includes(cuisine.id.toString())}
                        onChange={() => handleCuisineChange(cuisine.id.toString(), !formData.cuisineIds.includes(cuisine.id.toString()))}
                      />
                      <span className="truncate">{cuisine.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : selectedOutlet ? 'Save Changes' : 'Add Outlet'}
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