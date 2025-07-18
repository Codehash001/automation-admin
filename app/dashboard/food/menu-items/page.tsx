"use client";

import { useState, useEffect, useMemo } from 'react';
import { Plus, Pencil, Trash2, Search, Loader2, Utensils, Filter, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import Image from 'next/image';
import { ColumnDef } from "@tanstack/react-table";

interface MenuItem {
  id: number;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
  menu: {
    id: number;
    name: string;
    outlet: {
      id: number;
      name: string;
    };
    cuisine: {
      name: string;
    } | null;
  };
  createdAt: string;
  updatedAt: string;
}

interface Menu {
  id: number;
  name: string;
  outlet: {
    id: number;
    name: string;
  };
  cuisine: {
    name: string;
  } | null;
}

interface Outlet {
  id: number;
  name: string;
}

interface MenuItemRow extends MenuItem {
  // Add any additional properties if needed
}

export default function MenuItemsPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [selectedOutlet, setSelectedOutlet] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMenu, setSelectedMenu] = useState<string>('all');
  const [availability, setAvailability] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [menuSearchTerm, setMenuSearchTerm] = useState('');
  const [isMenuDropdownOpen, setIsMenuDropdownOpen] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',  
    imageUrl: '',
    isAvailable: true,
    menuId: '',
  });

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setFormData({ ...formData, price: value });
    }
  };

  // Fetch outlets
  const fetchOutlets = async () => {
    try {
      const response = await fetch('/api/food/outlet');
      if (!response.ok) throw new Error('Failed to fetch outlets');
      const data = await response.json();
      setOutlets(data);
    } catch (error) {
      console.error('Error fetching outlets:', error);
      toast({
        title: 'Error',
        description: 'Failed to load outlets',
        variant: 'destructive',
      });
    }
  };

  // Fetch menus for dropdown
  const fetchMenus = async (outletId?: string) => {
    try {
      const url = outletId && outletId !== 'all'
        ? `/api/food/menus?outletId=${outletId}`
        : '/api/food/menus';
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch menus');
      
      const data = await response.json();
      setMenus(data);
    } catch (error) {
      console.error('Error fetching menus:', error);
      toast({
        title: 'Error',
        description: 'Failed to load menus',
        variant: 'destructive',
      });
    }
  };

  // Update filtered menus when outlet changes
  useEffect(() => {
    if (selectedOutlet !== 'all') {
      // Reset selected menu when outlet changes
      setFormData(prev => ({ ...prev, menuId: '' }));
    }
  }, [selectedOutlet]);

  // Get filtered menus based on search term
  const filteredMenus = useMemo(() => {
    if (!menuSearchTerm) return menus;
    
    const searchLower = menuSearchTerm.toLowerCase();
    return menus.filter((menu: any) => 
      menu.name.toLowerCase().includes(searchLower) ||
      menu.outlet?.name.toLowerCase().includes(searchLower) ||
      menu.cuisine?.name?.toLowerCase().includes(searchLower)
    );
  }, [menus, menuSearchTerm]);

  // Group menus by outlet
  const groupedMenus = useMemo(() => {
    const menusToGroup = menuSearchTerm ? filteredMenus : menus;
    const grouped: Record<string, Menu[]> = {};
    
    menusToGroup.forEach(menu => {
      const outletName = menu.outlet?.name || 'Other';
      if (!grouped[outletName]) {
        grouped[outletName] = [];
      }
      grouped[outletName].push(menu);
    });
    
    return grouped;
  }, [filteredMenus, menus, menuSearchTerm]);

  // Fetch menu items
  const fetchMenuItems = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/food/menu-items');
      if (!response.ok) throw new Error('Failed to fetch menu items');
      
      const data = await response.json();
      console.log('Menu Items API Response:', data); // Debug log
      
      // Check if we have menu items and log their structure
      if (data && data.length > 0) {
        console.log('First menu item structure:', JSON.stringify(data[0], null, 2));
        if (data[0].menu) {
          console.log('Menu structure:', JSON.stringify(data[0].menu, null, 2));
        }
      }
      
      setMenuItems(data);
    } catch (error) {
      console.error('Error fetching menu items:', error);
      toast({
        title: 'Error',
        description: 'Failed to load menu items',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMenuItems();
  }, [selectedMenu, availability]);

  useEffect(() => {
    if (menuItems.length > 0) {
      console.log('Current menuItems state:', menuItems);
    }
  }, [menuItems]);

  const filteredItems = menuItems.filter((item: any) => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.menu.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    fetchOutlets();
    fetchMenus();
  }, []);

  const handleOpenDialog = (item: MenuItem | null = null) => {
    if (item) {
      setSelectedItem(item);
      // Pre-select the menu (outlet is determined by the menu)
      setFormData({
        name: item.name,
        description: item.description || '',
        price: item.price.toString(),
        imageUrl: item.imageUrl || '',
        isAvailable: item.isAvailable,
        menuId: item.menu.id.toString(),
      });
    } else {
      setSelectedItem(null);
      setFormData({
        name: '',
        description: '',
        price: '',
        imageUrl: '',
        isAvailable: true,
        menuId: '',
      });
    }
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (item: MenuItem) => {
    setSelectedItem(item);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.menuId || !formData.price) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const url = selectedItem 
        ? `/api/food/menu-items/${selectedItem.id}`
        : '/api/food/menu-items';
      
      const method = selectedItem ? 'PUT' : 'POST';
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        price: parseFloat(formData.price) || 0,  
        imageUrl: formData.imageUrl.trim() || null,
        isAvailable: formData.isAvailable,
        menuId: parseInt(formData.menuId, 10),
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save menu item');
      }

      toast({
        title: 'Success',
        description: selectedItem ? 'Menu item updated' : 'Menu item created',
      });
      
      setIsDialogOpen(false);
      fetchMenuItems();
    } catch (error) {
      console.error('Error saving menu item:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save menu item',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedItem) return;

    try {
      const response = await fetch(`/api/food/menu-items/${selectedItem.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete menu item');
      }

      toast({
        title: 'Success',
        description: 'Menu item deleted',
      });
      
      setIsDeleteDialogOpen(false);
      fetchMenuItems();
    } catch (error) {
      console.error('Error deleting menu item:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete menu item',
        variant: 'destructive',
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const columns: ColumnDef<MenuItemRow>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <div className="font-medium">{row.original.name}</div>
      ),
    },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ row }) => row.original.description || '-',
    },
    {
      accessorKey: 'outlet',
      header: 'Outlet',
      cell: ({ row }) => row.original.menu.outlet.name,
    },
    {
      accessorKey: 'menu',
      header: 'Menu',
      cell: ({ row }) => row.original.menu.name,
    },
    {
      accessorKey: 'price',
      header: 'Price',
      cell: ({ row }) => `AED ${row.original.price.toFixed(2)}`,
    },
    {
      accessorKey: 'isAvailable',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.isAvailable ? 'default' : 'secondary'}>
          {row.original.isAvailable ? 'Available' : 'Unavailable'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex space-x-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleOpenDialog(row.original)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSelectedItem(row.original);
              setIsDeleteDialogOpen(true);
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Menu Items</h1>
          <p className="text-muted-foreground">Manage your restaurant menu items</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Add Menu Item
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search menu items..."
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Menu</Label>
              <Select 
                value={selectedMenu} 
                onValueChange={setSelectedMenu}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Menus" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Menus</SelectItem>
                  {menus.length > 0 ? (
                    menus.map((menu) => (
                      <SelectItem key={menu.id} value={menu.id.toString()}>
                        <div className="flex items-center">
                          <span>{menu.name}</span>
                          {menu.cuisine?.name && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              ({menu.cuisine.name})
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  ) : (
                    <div className="p-2 text-sm text-muted-foreground">
                      No menus found
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Availability</Label>
              <Select 
                value={availability} 
                onValueChange={setAvailability}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="unavailable">Unavailable</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Utensils className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No menu items found</h3>
              <p className="text-sm text-muted-foreground">
                {searchTerm || selectedMenu !== 'all' || availability !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Get started by adding a new menu item'}
              </p>
              {!searchTerm && selectedMenu === 'all' && availability === 'all' && (
                <Button className="mt-4" onClick={() => handleOpenDialog()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Menu Item
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Outlet</TableHead>
                    <TableHead>Menu</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.name}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {item.description || 'No description'}
                      </TableCell>
                      <TableCell>
                        {item.menu?.outlet?.name || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{item.menu?.name || 'N/A'}</span>
                          {item.menu?.cuisine?.name && (
                            <span className="text-xs text-muted-foreground">
                              {item.menu.cuisine.name}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.price)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.isAvailable ? 'default' : 'secondary'}>
                          {item.isAvailable ? 'Available' : 'Unavailable'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(item)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedItem(item);
                              setIsDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
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

      {/* Add/Edit Menu Item Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {selectedItem ? 'Edit Menu Item' : 'Add New Menu Item'}
              </DialogTitle>
              <DialogDescription>
                {selectedItem 
                  ? 'Update the menu item details below.'
                  : 'Fill in the details to add a new menu item.'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Item Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., Margherita Pizza"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Menu *</Label>
                <Select
                  value={formData.menuId}
                  onValueChange={(value) => setFormData({ ...formData, menuId: value })}
                  open={isMenuDropdownOpen}
                  onOpenChange={setIsMenuDropdownOpen}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a menu" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[400px] overflow-y-auto">
                    <div className="px-3 py-2">
                      <Input
                        placeholder="Search menus..."
                        value={menuSearchTerm}
                        onChange={(e) => setMenuSearchTerm(e.target.value)}
                        className="w-full"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    
                    {Object.entries(groupedMenus).length > 0 ? (
                      Object.entries(groupedMenus).map(([outletName, outletMenus]) => (
                        <div key={outletName} className="space-y-1">
                          <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
                            {outletName}
                          </div>
                          {outletMenus.map((menu) => (
                            <SelectItem 
                              key={menu.id} 
                              value={menu.id.toString()}
                              className="pl-6"
                            >
                              <div className="flex items-center">
                                <span>{menu.name}</span>
                                {menu.cuisine?.name && (
                                  <span className="ml-2 text-xs text-muted-foreground">
                                    ({menu.cuisine.name})
                                  </span>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </div>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        No menus found
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Brief description of the item"
                  rows={3}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Price (AED) *</Label>
                  <Input
                    id="price"
                    type="text"  
                    inputMode="decimal"  
                    value={formData.price}
                    onChange={handlePriceChange}
                    placeholder="0.00"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Image URL (optional)</Label>
                  <Input
                    id="imageUrl"
                    value={formData.imageUrl}
                    onChange={(e) =>
                      setFormData({ ...formData, imageUrl: e.target.value })
                    }
                    placeholder="https://example.com/image.jpg"
                  />
                  {formData.imageUrl && (
                    <div className="mt-2">
                      <p className="text-xs text-muted-foreground mb-1">Image Preview:</p>
                      <div className="relative h-32 w-32 overflow-hidden rounded-md border">
                        <Image
                          src={formData.imageUrl}
                          alt="Preview"
                          fill
                          className="object-cover"
                          onError={(e) => {
                            // Handle image loading error
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center space-x-2 pt-2">
                <Switch
                  id="isAvailable"
                  checked={formData.isAvailable}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isAvailable: checked })
                  }
                />
                <Label htmlFor="isAvailable">Available</Label>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {selectedItem ? 'Saving...' : 'Creating...'}
                  </>
                ) : selectedItem ? (
                  'Save Changes'
                ) : (
                  'Create Item'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Menu Item</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedItem?.name}"? This action cannot be undone.
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
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
