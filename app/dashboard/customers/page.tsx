'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Pencil, Trash2, Phone, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

interface Customer {
  id: number;
  name: string;
  whatsappNumber: string;
  createdAt: string;
  _count?: {
    orders: number;
  };
}

export default function CustomersPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    whatsappNumber: '',
  });

  // Fetch customers
  const fetchCustomers = async () => {
    try {
      const response = await fetch('/api/customer');
      if (!response.ok) throw new Error('Failed to fetch customers');
      const data = await response.json();
      setCustomers(data);
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast({
        title: 'Error',
        description: 'Failed to load customers. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  // Filter customers based on search term
  const filteredCustomers = customers.filter(
    (customer: any) =>
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.whatsappNumber.includes(searchTerm)
  );

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = selectedCustomer ? 'PUT' : 'POST';
      const url = selectedCustomer
        ? `/api/customer?id=${selectedCustomer.id}`
        : '/api/customer';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save customer');
      }

      const result = await response.json();
      
      toast({
        title: selectedCustomer ? 'Customer Updated' : 'Customer Created',
        description: selectedCustomer 
          ? 'Customer details have been updated successfully.'
          : 'New customer has been added successfully.',
      });

      // Reset form and refetch customers
      setFormData({ name: '', whatsappNumber: '' });
      setSelectedCustomer(null);
      setIsDialogOpen(false);
      fetchCustomers();
    } catch (error) {
      console.error('Error saving customer:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save customer',
        variant: 'destructive',
      });
    }
  };

  // Handle edit customer
  const handleEdit = (customer: Customer) => {
    setSelectedCustomer(customer);
    setFormData({
      name: customer.name,
      whatsappNumber: customer.whatsappNumber,
    });
    setIsDialogOpen(true);
  };

  // Handle delete customer
  const handleDelete = async () => {
    if (!selectedCustomer) return;

    try {
      const response = await fetch(`/api/customer?id=${selectedCustomer.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete customer');

      toast({
        title: 'Customer Deleted',
        description: 'The customer has been removed successfully.',
      });

      // Reset and refetch
      setSelectedCustomer(null);
      setIsDeleteDialogOpen(false);
      fetchCustomers();
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete customer. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Customers</h1>
            <p className="text-muted-foreground">
              Manage your customers and their information
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setSelectedCustomer(null)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Customer
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {selectedCustomer ? 'Edit Customer' : 'Add New Customer'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="name" className="text-sm font-medium">
                    Name
                  </label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="whatsappNumber" className="text-sm font-medium">
                    WhatsApp Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="whatsappNumber"
                      name="whatsappNumber"
                      type="tel"
                      value={formData.whatsappNumber}
                      onChange={handleInputChange}
                      required
                      placeholder="+1234567890"
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(false);
                      setSelectedCustomer(null);
                      setFormData({ name: '', whatsappNumber: '' });
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">
                    {selectedCustomer ? 'Update' : 'Create'} Customer
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex items-center space-x-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search customers by name or number..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>WhatsApp Number</TableHead>
                <TableHead>Orders</TableHead>
                <TableHead>Member Since</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredCustomers.length > 0 ? (
                filteredCustomers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center space-x-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <span>{customer.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{customer.whatsappNumber}</TableCell>
                    <TableCell>{customer._count?.orders || 0} orders</TableCell>
                    <TableCell>{formatDate(customer.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(customer)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedCustomer(customer);
                            setIsDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    {searchTerm ? 'No matching customers found' : 'No customers found'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedCustomer?.name} and all their data. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}