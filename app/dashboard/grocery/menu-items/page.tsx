"use client";

import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Search, AlertCircle, Filter } from 'lucide-react';
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
    store: {
      id: number;
      name: string;
    };
  };
}

interface Menu {
  id: number;
  name: string;
  store: {
    id: number;
    name: string;
  };
}

interface Store {
  id: number;
  name: string;
}

export default function GroceryMenuItemsPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(null);
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [selectedMenu, setSelectedMenu] = useState<string>('');
  const [filteredMenus, setFilteredMenus] = useState<Menu[]>([]);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    imageUrl: '',
    menuId: '',
    isAvailable: true,
  });

  // Fetch menu items
  const fetchMenuItems = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedMenu) params.append('menuId', selectedMenu);
      if (selectedStore) params.append('storeId', selectedStore);
      
      const response = await fetch(`/api/grocery/menu-items?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch menu items');
      
      const data = await response.json();
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

  // Fetch stores and menus for filters
  const fetchFilters = async () => {
    try {
      const [storesRes, menusRes] = await Promise.all([
        fetch('/api/grocery/store'),
        fetch('/api/grocery/menus')
      ]);
      
      if (!storesRes.ok || !menusRes.ok) throw new Error('Failed to fetch filters');
      
      const [storesData, menusData] = await Promise.all([
        storesRes.json(),
        menusRes.json()
      ]);
      
      setStores(storesData);
      setMenus(menusData);
      setFilteredMenus(menusData);
    } catch (error) {
      console.error('Error fetching filters:', error);
    }
  };

  useEffect(() => {
    fetchMenuItems();
    fetchFilters();
  }, [selectedMenu, selectedStore]);

  // Filter menus based on selected store
  useEffect(() => {
    if (selectedStore) {
      const filtered = menus.filter(menu => menu.store.id.toString() === selectedStore);
      setFilteredMenus(filtered);
      
      // Reset menu selection if the selected menu doesn't belong to the selected store
      if (selectedMenu && !filtered.some(menu => menu.id.toString() === selectedMenu)) {
        setSelectedMenu('');
      }
    } else {
      setFilteredMenus(menus);
    }
  }, [selectedStore, menus, selectedMenu]);

  const filteredMenuItems = menuItems.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenDialog = (menuItem: MenuItem | null = null) => {
    if (menuItem) {
      setSelectedMenuItem(menuItem);
      setFormData({
        name: menuItem.name,
        description: menuItem.description || '',
        price: menuItem.price.toString(),
        imageUrl: menuItem.imageUrl || '',
        menuId: menuItem.menu.id.toString(),
        isAvailable: menuItem.isAvailable,
      });
      
      // Set the store filter to match the menu item's store
      setSelectedStore(menuItem.menu.store.id.toString());
    } else {
      setSelectedMenuItem(null);
      setFormData({
        name: '',
        description: '',
        price: '',
        imageUrl: '',
        menuId: '',
        isAvailable: true,
      });
    }
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (menuItem: MenuItem) => {
    setSelectedMenuItem(menuItem);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (!formData.name || !formData.menuId || !formData.price) {
        toast({
          title: 'Validation Error',
          description: 'Name, Menu, and Price are required fields',
          variant: 'destructive',
        });
        return;
      }

      const price = parseFloat(formData.price);
      if (isNaN(price) || price < 0) {
        toast({
          title: 'Validation Error',
          description: 'Price must be a valid positive number',
          variant: 'destructive',
        });
        return;
      }

      const menuItemData = {
        name: formData.name,
        description: formData.description || null,
        price: price,
        imageUrl: formData.imageUrl || null,
        menuId: parseInt(formData.menuId),
        isActive: formData.isAvailable,
      };

      const url = selectedMenuItem
        ? `/api/grocery/menu-items?id=${selectedMenuItem.id}`
        : '/api/grocery/menu-items';
      
      const method = selectedMenuItem ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(menuItemData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save menu item');
      }

      toast({
        title: 'Success',
        description: selectedMenuItem
          ? 'Menu item updated successfully'
          : 'Menu item created successfully',
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
    }
  };

  const handleDelete = async () => {
    if (!selectedMenuItem) return;
    
    try {
      const response = await fetch(`/api/grocery/menu-items?id=${selectedMenuItem.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete menu item');
      }

      toast({
        title: 'Success',
        description: 'Menu item deleted successfully',
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

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
    }).format(price);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Grocery Menu Items</h1>
        <Button onClick={() => handleOpenDialog(null)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Menu Item
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter and search menu items</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search menu items..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="w-full md:w-[200px]">
              <Select
                value={selectedStore}
                onValueChange={setSelectedStore}
              >
                <SelectTrigger>
                  <div className="flex items-center">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter by Store" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stores</SelectItem>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id.toString()}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full md:w-[200px]">
              <Select
                value={selectedMenu}
                onValueChange={setSelectedMenu}
              >
                <SelectTrigger>
                  <div className="flex items-center">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter by Menu" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Menus</SelectItem>
                  {filteredMenus.map((menu) => (
                    <SelectItem key={menu.id} value={menu.id.toString()}>
                      {menu.name} ({menu.store.name})
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
            <div className="text-center py-4">Loading menu items...</div>
          ) : filteredMenuItems.length === 0 ? (
            <div className="text-center py-4">No menu items found</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Menu</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMenuItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.description || '-'}</TableCell>
                      <TableCell>{formatPrice(item.price)}</TableCell>
                      <TableCell>{item.menu.name}</TableCell>
                      <TableCell>{item.menu.store.name}</TableCell>
                      <TableCell>
                        <Badge variant={item.isAvailable ? "default" : "secondary"}>
                          {item.isAvailable ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
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
                            className="text-destructive"
                            onClick={() => handleDeleteClick(item)}
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
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {selectedMenuItem ? 'Edit Menu Item' : 'Add Menu Item'}
            </DialogTitle>
            <DialogDescription>
              {selectedMenuItem
                ? 'Update the details of the menu item'
                : 'Add a new menu item to the system'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Item Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Item Name"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Brief description of the menu item"
                  rows={3}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="price">Price (AED) *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) =>
                    setFormData({ ...formData, price: e.target.value })
                  }
                  placeholder="0.00"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label>Store *</Label>
                <Select
                  value={selectedStore}
                  onValueChange={(value) => {
                    setSelectedStore(value);
                    // Reset menu selection when store changes
                    setFormData({ ...formData, menuId: '' });
                  }}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a store" />
                  </SelectTrigger>
                  <SelectContent>
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={store.id.toString()}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Menu *</Label>
                <Select
                  value={formData.menuId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, menuId: value })
                  }
                  required
                  disabled={!selectedStore}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={selectedStore ? "Select a menu" : "Select a store first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredMenus.map((menu) => (
                      <SelectItem key={menu.id} value={menu.id.toString()}>
                        {menu.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
              >
                Cancel
              </Button>
              <Button type="submit">
                {selectedMenuItem ? 'Update Menu Item' : 'Create Menu Item'}
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
              Are you sure you want to delete the menu item "{selectedMenuItem?.name}"?
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
