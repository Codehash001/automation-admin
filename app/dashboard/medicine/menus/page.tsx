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

export default function MedicineMenusPage() {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState<Menu | null>(null);
  const [selectedStore, setSelectedStore] = useState<string>('all');
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
      
      const response = await fetch(`/api/medicine/menus?${params.toString()}`);
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
  const fetchStores = async () => {
    try {
      const response = await fetch('/api/medicine/store');
      if (!response.ok) throw new Error('Failed to fetch stores');
      
      const data = await response.json();
      setStores(data);
    } catch (error) {
      console.error('Error fetching stores:', error);
    }
  };

  useEffect(() => {
    fetchMenus();
    fetchStores();
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
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        storeId: parseInt(formData.storeId),
        isActive: formData.isActive,
      };

      let response;
      
      if (selectedMenu) {
        // Update existing menu
        response = await fetch(`/api/medicine/menus?id=${selectedMenu.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        // Create new menu
        response = await fetch('/api/medicine/menus', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

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
    } catch (error: any) {
      console.error('Error saving menu:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save menu',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!selectedMenu) return;
    
    try {
      const response = await fetch(`/api/medicine/menus?id=${selectedMenu.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete menu');
      }

      toast({
        title: 'Success',
        description: 'Menu deleted successfully',
      });
      
      setIsDeleteDialogOpen(false);
      fetchMenus();
    } catch (error: any) {
      console.error('Error deleting menu:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete menu',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Medicine Menus</CardTitle>
            <CardDescription>
              Manage your medicine menus for each medical store
            </CardDescription>
          </div>
          <Button onClick={() => handleOpenDialog(null)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Menu
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
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
            <div className="w-full md:w-64">
              <Select
                value={selectedStore}
                onValueChange={setSelectedStore}
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
          </div>

          {isLoading ? (
            <div className="text-center py-10">Loading...</div>
          ) : filteredMenus.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              No menus found
            </div>
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
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMenus.map((menu) => (
                    <TableRow key={menu.id}>
                      <TableCell className="font-medium">{menu.name}</TableCell>
                      <TableCell>
                        {menu.description ? (
                          menu.description.length > 50
                            ? `${menu.description.substring(0, 50)}...`
                            : menu.description
                        ) : (
                          <span className="text-muted-foreground italic">No description</span>
                        )}
                      </TableCell>
                      <TableCell>{menu.store.name}</TableCell>
                      <TableCell>
                        {menu.isActive ? (
                          <Badge className="bg-green-500">Active</Badge>
                        ) : (
                          <Badge variant="outline">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell>{menu._count?.items || 0}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
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
                ? 'Update the details of your medicine menu'
                : 'Add a new medicine menu to your medical store'}
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
                  placeholder="Enter menu name"
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
