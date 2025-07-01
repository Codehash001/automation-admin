"use client";

import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Search, AlertCircle, Utensils, Filter } from 'lucide-react';
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
  cuisine: {
    id: number;
    name: string;
  } | null;
  outlet: {
    id: number;
    name: string;
  };
  _count: {
    items: number;
  };
}

interface Cuisine {
  id: number;
  name: string;
}

interface Outlet {
  id: number;
  name: string;
}

export default function MenusPage() {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [cuisines, setCuisines] = useState<Cuisine[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState<Menu | null>(null);
  const [selectedOutlet, setSelectedOutlet] = useState<string>('');
  const [selectedCuisine, setSelectedCuisine] = useState<string>('');
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    outletId: '',
    cuisineId: '',
    isActive: true,
  });

  // Fetch menus
  const fetchMenus = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedOutlet) params.append('outletId', selectedOutlet);
      if (selectedCuisine) params.append('cuisineId', selectedCuisine);
      
      const response = await fetch(`/api/food/menus?${params.toString()}`);
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

  // Fetch cuisines and outlets for filters
  const fetchFilters = async () => {
    try {
      const [cuisinesRes, outletsRes] = await Promise.all([
        fetch('/api/food/cuisine'),
        fetch('/api/food/outlet')
      ]);
      
      if (!cuisinesRes.ok || !outletsRes.ok) throw new Error('Failed to fetch filters');
      
      const [cuisinesData, outletsData] = await Promise.all([
        cuisinesRes.json(),
        outletsRes.json()
      ]);
      
      setCuisines(cuisinesData);
      setOutlets(outletsData);
    } catch (error) {
      console.error('Error fetching filters:', error);
    }
  };

  useEffect(() => {
    fetchMenus();
    fetchFilters();
  }, [selectedOutlet, selectedCuisine]);

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
        outletId: menu.outlet.id.toString(),
        cuisineId: menu.cuisine?.id?.toString() || '',
        isActive: menu.isActive,
      });
    } else {
      setSelectedMenu(null);
      setFormData({
        name: '',
        description: '',
        outletId: '',
        cuisineId: '',
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
    
    if (!formData.name || !formData.outletId) {
      toast({
        title: 'Error',
        description: 'Name and outlet are required',
        variant: 'destructive',
      });
      return;
    }

    try {
      const url = selectedMenu 
        ? `/api/food/menus/${selectedMenu.id}`
        : '/api/food/menus';
      
      const method = selectedMenu ? 'PUT' : 'POST';
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        outletId: parseInt(formData.outletId),
        cuisineId: formData.cuisineId ? parseInt(formData.cuisineId) : null,
        isActive: formData.isActive,
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
        throw new Error(error.error || 'Failed to save menu');
      }

      const result = await response.json();
      
      toast({
        title: 'Success',
        description: selectedMenu ? 'Menu updated successfully' : 'Menu created successfully',
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
      const response = await fetch(`/api/food/menus/${selectedMenu.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete menu');
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Menus</h1>
          <p className="text-muted-foreground">Manage your restaurant menus</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Add Menu
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search menus..."
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Outlet</Label>
              <Select 
                value={selectedOutlet} 
                onValueChange={setSelectedOutlet}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Outlets" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Outlets</SelectItem>
                  {outlets.map((outlet) => (
                    <SelectItem key={outlet.id} value={outlet.id.toString()}>
                      {outlet.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Cuisine</Label>
              <Select 
                value={selectedCuisine} 
                onValueChange={setSelectedCuisine}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Cuisines" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cuisines</SelectItem>
                  {cuisines.map((cuisine) => (
                    <SelectItem key={cuisine.id} value={cuisine.id.toString()}>
                      {cuisine.name}
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
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : filteredMenus.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Utensils className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No menus found</h3>
              <p className="text-sm text-muted-foreground">
                {searchTerm || selectedOutlet || selectedCuisine 
                  ? 'Try adjusting your search or filters'
                  : 'Get started by adding a new menu'}
              </p>
              {!searchTerm && !selectedOutlet && !selectedCuisine && (
                <Button className="mt-4" onClick={() => handleOpenDialog()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Menu
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
                    <TableHead>Cuisine</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMenus.map((menu) => (
                    <TableRow key={menu.id}>
                      <TableCell className="font-medium">{menu.name}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {menu.description || 'No description'}
                      </TableCell>
                      <TableCell>{menu.outlet?.name || '-'}</TableCell>
                      <TableCell>{menu.cuisine?.name || '-'}</TableCell>
                      <TableCell>{menu._count.items}</TableCell>
                      <TableCell>
                        <Badge variant={menu.isActive ? 'default' : 'outline'}>
                          {menu.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(menu)}
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteClick(menu)}
                            className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete</span>
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

      {/* Add/Edit Menu Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {selectedMenu ? 'Edit Menu' : 'Add New Menu'}
              </DialogTitle>
              <DialogDescription>
                {selectedMenu 
                  ? 'Update the menu details below.'
                  : 'Fill in the details to create a new menu.'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Menu Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., Lunch Menu, Dinner Specials"
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
                <Label>Outlet *</Label>
                <Select
                  value={formData.outletId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, outletId: value })
                  }
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an outlet" />
                  </SelectTrigger>
                  <SelectContent>
                    {outlets.map((outlet) => (
                      <SelectItem key={outlet.id} value={outlet.id.toString()}>
                        {outlet.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Cuisine (Optional)</Label>
                <Select
                  value={formData.cuisineId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, cuisineId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a cuisine (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {cuisines.map((cuisine) => (
                      <SelectItem key={cuisine.id} value={cuisine.id.toString()}>
                        {cuisine.name}
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
              Are you sure you want to delete the menu "{selectedMenu?.name}"? This action cannot be undone.
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
