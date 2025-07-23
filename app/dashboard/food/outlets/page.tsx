"use client";

import { useState, useEffect, useRef } from 'react';
import { Plus, Pencil, Trash2, Search, AlertCircle, Utensils, Phone, Map, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
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
type AdditionalPrice = {
  id?: number;
  name: string;
  value: number;
  type: 'fixed' | 'percentage';
  isActive: boolean;
};

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
  additionalPrices: AdditionalPrice[];
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
  const [mapStyle, setMapStyle] = useState<'standard' | 'standard-satellite'>('standard');
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
      open: '09:00',
      close: '23:00',
    },
    additionalPrices: [
      { name: 'VAT', value: 5, type: 'percentage' as const, isActive: true },
      { name: 'SERVICE_FEE', value: 10, type: 'fixed' as const, isActive: true },
      { name: 'DELIVERY_FEE', value: 15, type: 'fixed' as const, isActive: true },
    ] as AdditionalPrice[],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const mapRef = useRef<HTMLDivElement>(null);
  const mapboxMap = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [mapInitialized, setMapInitialized] = useState(false); // Track if map is initialized
  const currentZoomRef = useRef<number>(13); // Store current zoom level
  let isDragging = false;

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
            style: `mapbox://styles/mapbox/${mapStyle}`,
            center: [55.296249, 25.276987],
            zoom: 13,
          });

          // Store zoom level changes
          mapboxMap.current.on('zoomend', () => {
            if (mapboxMap.current) {
              currentZoomRef.current = mapboxMap.current.getZoom();
            }
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
  }, [mapStyle]);

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
        additionalPrices: selectedOutlet.additionalPrices.length > 0 
          ? selectedOutlet.additionalPrices 
          : [
              { name: 'VAT', value: 5, type: 'percentage' as const, isActive: true },
              { name: 'SERVICE_FEE', value: 10, type: 'fixed' as const, isActive: true },
              { name: 'DELIVERY_FEE', value: 15, type: 'fixed' as const, isActive: true },
            ],
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
          style: `mapbox://styles/mapbox/${mapStyle}`,
          center: [55.2708, 25.2048],
          zoom: currentZoomRef.current,
        });
        
        // Store zoom level changes
        mapboxMap.current.on('zoomend', () => {
          if (mapboxMap.current) {
            currentZoomRef.current = mapboxMap.current.getZoom();
          }
        });
        
        // Add click event to place marker
        mapboxMap.current.on('click', function (e: any) {
          const lat = e.lngLat.lat.toFixed(6);
          const lng = e.lngLat.lng.toFixed(6);

          setFormData(prev => ({
            ...prev,
            exactLocation: { lat, lng }
          }));

          // Create or update marker
          createOrUpdateMarker(mapboxgl, lng, lat);
        });

        // Add marker if location already exists
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

    // Import mapbox-gl dynamically and update marker
    import('mapbox-gl').then((mapboxModule) => {
      createOrUpdateMarker(mapboxModule.default, lng, lat);
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

  // Add a new price field
  const addPriceField = () => {
    setFormData(prev => ({
      ...prev,
      additionalPrices: [
        ...prev.additionalPrices,
        { name: '', value: 0, type: 'fixed', isActive: true }
      ]
    }));
  };

  // Update a price field
  const updatePriceField = (index: number, field: keyof AdditionalPrice, value: any) => {
    const newPrices = [...formData.additionalPrices];
    (newPrices[index] as any)[field] = field === 'value' ? parseFloat(value) || 0 : value;
    
    setFormData(prev => ({
      ...prev,
      additionalPrices: newPrices
    }));
  };

  // Remove a price field
  const removePriceField = (index: number) => {
    const newPrices = formData.additionalPrices.filter((_, i) => i !== index);
    setFormData(prev => ({
      ...prev,
      additionalPrices: newPrices
    }));
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
        open: '09:00',
        close: '23:00',
      },
      additionalPrices: [
        { name: 'VAT', value: 5, type: 'percentage', isActive: true },
        { name: 'SERVICE_FEE', value: 10, type: 'fixed', isActive: true },
        { name: 'DELIVERY_FEE', value: 15, type: 'fixed', isActive: true },
      ],
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
      additionalPrices: outlet.additionalPrices.length > 0 
        ? outlet.additionalPrices 
        : [
            { name: 'VAT', value: 5, type: 'percentage' as const, isActive: true },
            { name: 'SERVICE_FEE', value: 10, type: 'fixed' as const, isActive: true },
            { name: 'DELIVERY_FEE', value: 15, type: 'fixed' as const, isActive: true },
          ],
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
      
      // Filter out invalid price entries
      const validPrices = formData.additionalPrices.filter(p => p.name.trim() !== '' && p.value > 0);
      
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
        additionalPrices: validPrices,
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

  // Update the table to show additional prices
  const renderAdditionalPrices = (prices: AdditionalPrice[]) => {
    if (!prices || prices.length === 0) return 'No additional prices';
    
    return (
      <div className="space-y-1">
        {prices.filter(p => p.isActive).map((price, idx) => (
          <div key={idx} className="text-xs">
            {price.name}: {price.value}{price.type === 'percentage' ? '%' : ' AED'}
          </div>
        ))}
      </div>
    );
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
              <TableHead>Additional Prices</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  Loading outlets...
                </TableCell>
              </TableRow>
            ) : filteredOutlets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
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
                  <TableCell>
                    {renderAdditionalPrices(outlet.additionalPrices || [])}
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
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-[95vw] h-[95vh] p-0 overflow-hidden">
          <form onSubmit={handleSubmit} className="flex h-full">
            {/* Left Sidebar with Form */}
            <div className="w-1/3 h-full flex flex-col border-r">
              <div className="p-6 pb-0 flex-shrink-0">
                <DialogHeader>
                  <DialogTitle>{selectedOutlet ? 'Edit Outlet' : 'Add New Outlet'}</DialogTitle>
                </DialogHeader>
              </div>
              
              {/* Scrollable Form Content */}
              <div className="flex-grow overflow-y-auto p-6 pt-4" style={{ maxHeight: 'calc(95vh - 140px)' }}>
                <div className="space-y-4">
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

                  {/* Exact Location Fields */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Exact Location (Lat, Lng - Please choose from the map) <span className="text-red-500">*</span></label>
                    <div className="flex gap-2 items-center">
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
                    <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto p-1 border rounded-md bg-background">
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

                  {/* Additional Prices */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Additional Prices</label>
                    {formData.additionalPrices.map((price, index) => (
                      <div key={index} className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-4">
                          <Input
                            placeholder="Price name (e.g., VAT)"
                            value={price.name}
                            onChange={(e) => updatePriceField(index, 'name', e.target.value)}
                          />
                        </div>
                        
                        <div className="col-span-2">
                          <Input
                            type="number"
                            placeholder="Value"
                            value={price.value}
                            onChange={(e) => updatePriceField(index, 'value', e.target.value)}
                            min={0}
                            step={0.01}
                          />
                        </div>
                        
                        <div className="col-span-3">
                          <Select
                            value={price.type}
                            onValueChange={(value: 'fixed' | 'percentage') => updatePriceField(index, 'type', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="fixed">Fixed Amount (AED)</SelectItem>
                              <SelectItem value="percentage">Percentage (%)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="col-span-2 flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`active-${index}`}
                            checked={price.isActive}
                            onChange={(e) => updatePriceField(index, 'isActive', e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <label htmlFor={`active-${index}`} className="text-sm">
                            Active
                          </label>
                        </div>
                        
                        <div className="col-span-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removePriceField(index)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={addPriceField}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Price
                    </Button>
                  </div>
                </div>
              </div>
              
              {/* Fixed Footer with Buttons */}
              <div className="p-6 border-t bg-background">
                <DialogFooter className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" onClick={handleSubmit} disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : selectedOutlet ? 'Save Changes' : 'Add Outlet'}
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
                    const newStyle = mapStyle === 'standard' ? 'standard-satellite' : 'standard';
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