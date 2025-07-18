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

interface Menu {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  store: {
    id: number;
    name: string;
  };
  _count: {
    items: number;
  };
}

interface Store {
  id: number;
  name: string;
}

export default function GroceryMenusPage() {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState<Menu | null>(null);
  const [selectedStore, setSelectedStore] = useState<string>('');
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    storeId: '',
    isActive: true,
  });

  // Fetch menus
  const fetchMenus = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedStore && selectedStore !== 'all') params.append('storeId', selectedStore);
      
      const response = await fetch(`/api/grocery/menus?${params.toString()}`);
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
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch stores for filters
  const fetchFilters = async () => {
    try {
      const storesRes = await fetch('/api/grocery/store');
      
      if (!storesRes.ok) throw new Error('Failed to fetch filters');
      
      const storesData = await storesRes.json();
      setStores(storesData);
    } catch (error) {
      console.error('Error fetching filters:', error);
    }
  };

  useEffect(() => {
    fetchMenus();
    fetchFilters();
  }, [selectedStore]);

  const filteredMenus = menus.filter(menu => 
    menu.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    menu.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenDialog = (menu: Menu | null = null) => {
    if (menu) {
      setSelectedMenu(menu);
      setFormData({
        name: menu.name,
        description: menu.description || '',
        storeId: menu.store.id.toString(),
        isActive: menu.isActive,
      });
    } else {
      setSelectedMenu(null);
      setFormData({
        name: '',
        description: '',
        storeId: '',
        isActive: true,
      });
    }
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (menu: Menu) => {
    setSelectedMenu(menu);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (!formData.name || !formData.storeId) {
        toast({
          title: 'Validation Error',
          description: 'Name and Store are required fields',
          variant: 'destructive',
        });
        return;
      }

      const menuData = {
        name: formData.name,
        description: formData.description || null,
        storeId: parseInt(formData.storeId),
        isActive: formData.isActive,
      };

      const url = selectedMenu
        ? `/api/grocery/menus?id=${selectedMenu.id}`
        : '/api/grocery/menus';
      
      const method = selectedMenu ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(menuData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save menu');
      }

      toast({
        title: 'Success',
        description: selectedMenu
          ? 'Menu updated successfully'
          : 'Menu created successfully',
      });

      setIsDialogOpen(false);
      fetchMenus();
    } catch (error) {
      console.error('Error saving menu:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save menu',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!selectedMenu) return;
    
    try {
      const response = await fetch(`/api/grocery/menus?id=${selectedMenu.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete menu');
      }

      toast({
        title: 'Success',
        description: 'Menu deleted successfully',
      });

      setIsDeleteDialogOpen(false);
      fetchMenus();
    } catch (error) {
      console.error('Error deleting menu:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete menu',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Grocery Menus</h1>
        <Button onClick={() => handleOpenDialog(null)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Menu
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter and search menus</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search menus..."
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
                <SelectContent>
                  <SelectItem value="all">All Stores</SelectItem>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id.toString()}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
                <SelectTrigger>
                  <div className="flex items-center">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter by Store" />
                  </div>
                </SelectTrigger>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-4">Loading menus...</div>
          ) : filteredMenus.length === 0 ? (
            <div className="text-center py-4">No menus found</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMenus.map((menu) => (
                    <TableRow key={menu.id}>
                      <TableCell className="font-medium">{menu.name}</TableCell>
                      <TableCell>{menu.description || '-'}</TableCell>
                      <TableCell>{menu.store.name}</TableCell>
                      <TableCell>
                        {menu.isActive ? (
                          <Badge className="bg-green-500">Active</Badge>
                        ) : (
                          <Badge variant="outline">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell>{menu._count?.items || 0}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(menu)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => handleDeleteClick(menu)}
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
              {selectedMenu ? 'Edit Menu' : 'Add Menu'}
            </DialogTitle>
            <DialogDescription>
              {selectedMenu
                ? 'Update the details of the menu'
                : 'Add a new menu to the system'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Menu Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Menu Name"
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
                  placeholder="Brief description of the menu"
                  rows={3}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Store *</Label>
                <Select
                  value={formData.storeId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, storeId: value })
                  }
                  required
                >
                  <SelectContent>
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={store.id.toString()}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a store" />
                  </SelectTrigger>
                </Select>
              </div>
              
              <div className="flex items-center space-x-2 pt-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isActive: checked })
                  }
                />
                <Label htmlFor="isActive">Active</Label>
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
                {selectedMenu ? 'Update Menu' : 'Create Menu'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Menu</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the menu "{selectedMenu?.name}"?
              {(selectedMenu?._count?.items ?? 0) > 0 && (
                <div className="mt-2 text-destructive flex items-center">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  This menu has {selectedMenu?._count?.items} item(s) and cannot be deleted.
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
              disabled={(selectedMenu?._count?.items ?? 0) > 0}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
