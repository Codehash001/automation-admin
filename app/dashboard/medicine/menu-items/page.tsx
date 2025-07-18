"use client";

import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Search, Filter } from 'lucide-react';
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

export default function MedicineMenuItemsPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(null);
  const [selectedStore, setSelectedStore] = useState<string>('all');
  const [selectedMenu, setSelectedMenu] = useState<string>('all');
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    menuId: '',
    isAvailable: true,
  });

  // Fetch menu items
  const fetchMenuItems = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedStore && selectedStore !== 'all') params.append('storeId', selectedStore);
      if (selectedMenu && selectedMenu !== 'all') params.append('menuId', selectedMenu);
      
      const response = await fetch(`/api/medicine/menu-items?${params.toString()}`);
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
      // Fetch stores
      const storesResponse = await fetch('/api/medicine/store');
      if (!storesResponse.ok) throw new Error('Failed to fetch stores');
      const storesData = await storesResponse.json();
      setStores(storesData);

      // Fetch menus (filtered by store if selected)
      const menuParams = new URLSearchParams();
      if (selectedStore && selectedStore !== 'all') menuParams.append('storeId', selectedStore);
      
      const menusResponse = await fetch(`/api/medicine/menus?${menuParams.toString()}`);
      if (!menusResponse.ok) throw new Error('Failed to fetch menus');
      const menusData = await menusResponse.json();
      setMenus(menusData);

      // Reset menu selection if the selected menu doesn't belong to the selected store
      if (selectedStore && selectedStore !== 'all' && selectedMenu && selectedMenu !== 'all') {
        const menuExists = menusData.some((menu: Menu) => menu.id.toString() === selectedMenu);
        if (!menuExists) {
          setSelectedMenu('all');
        }
      }
    } catch (error) {
      console.error('Error fetching filters:', error);
    }
  };

  useEffect(() => {
    fetchMenuItems();
    fetchFilters();
  }, [selectedStore, selectedMenu]);

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
        menuId: menuItem.menu.id.toString(),
        isAvailable: menuItem.isAvailable,
      });
    } else {
      setSelectedMenuItem(null);
      setFormData({
        name: '',
        description: '',
        price: '',
        menuId: selectedMenu || '',
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
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        price: parseFloat(formData.price),
        menuId: parseInt(formData.menuId),
        isActive: formData.isAvailable,
      };

      // Validate price
      if (isNaN(payload.price) || payload.price <= 0) {
        throw new Error('Price must be a positive number');
      }

      let response;
      
      if (selectedMenuItem) {
        // Update existing menu item
        response = await fetch(`/api/medicine/menu-items?id=${selectedMenuItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        // Create new menu item
        response = await fetch('/api/medicine/menu-items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

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
    } catch (error: any) {
      console.error('Error saving menu item:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save menu item',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!selectedMenuItem) return;
    
    try {
      const response = await fetch(`/api/medicine/menu-items?id=${selectedMenuItem.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete menu item');
      }

      toast({
        title: 'Success',
        description: 'Menu item deleted successfully',
      });
      
      setIsDeleteDialogOpen(false);
      fetchMenuItems();
    } catch (error: any) {
      console.error('Error deleting menu item:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete menu item',
        variant: 'destructive',
      });
    }
  };

  const handleStoreChange = (value: string) => {
    setSelectedStore(value);
    setSelectedMenu('all'); // Reset menu selection when store changes
  };

  return (
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Medicine Menu Items</CardTitle>
            <CardDescription>
              Manage your medicine menu items for each menu
            </CardDescription>
          </div>
          <Button onClick={() => handleOpenDialog(null)} disabled={menus.length === 0}>
            <Plus className="mr-2 h-4 w-4" />
            Add Menu Item
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
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
            <div className="w-full md:w-64">
              <Select
                value={selectedStore}
                onValueChange={handleStoreChange}
              >
                <SelectTrigger>
                  <div className="flex items-center">
                    <Filter className="mr-2 h-4 w-4" />
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
            <div className="w-full md:w-64">
              <Select
                value={selectedMenu}
                onValueChange={setSelectedMenu}
                disabled={menus.length === 0}
              >
                <SelectTrigger>
                  <div className="flex items-center">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Filter by Menu" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Menus</SelectItem>
                  {menus.map((menu) => (
                    <SelectItem key={menu.id} value={menu.id.toString()}>
                      {menu.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-10">Loading...</div>
          ) : filteredMenuItems.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              No menu items found
            </div>
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
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMenuItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>
                        {item.description ? (
                          item.description.length > 50
                            ? `${item.description.substring(0, 50)}...`
                            : item.description
                        ) : (
                          <span className="text-muted-foreground italic">No description</span>
                        )}
                      </TableCell>
                      <TableCell>{(item.price)}</TableCell>
                      <TableCell>{item.menu.name}</TableCell>
                      <TableCell>{item.menu.store.name}</TableCell>
                      <TableCell>
                        <Badge variant={item.isAvailable ? "default" : "secondary"}>
                          {item.isAvailable ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
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
                ? 'Update the details of your medicine menu item'
                : 'Add a new medicine menu item to your menu'}
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
                  placeholder="Enter item name"
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
                <Label>Menu *</Label>
                <Select
                  value={formData.menuId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, menuId: value })
                  }
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a menu" />
                  </SelectTrigger>
                  <SelectContent>
                    {menus.map((menu) => (
                      <SelectItem key={menu.id} value={menu.id.toString()}>
                        {menu.name} ({menu.store.name})
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
                {selectedMenuItem ? 'Update Item' : 'Create Item'}
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
