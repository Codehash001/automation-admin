'use client';

import { useState, useEffect } from 'react';
import { z } from 'zod';
import { DataTable } from '@/components/DataTable';
import { FormDialog } from '@/components/FormDialog';
import { useToast } from '@/hooks/use-toast';

const emirateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
});

type Emirate = {
  id: number;
  name: string;
};

export default function EmiratesPage() {
  const [emirates, setEmirates] = useState<Emirate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentEmirate, setCurrentEmirate] = useState<Emirate | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const fetchEmirates = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/emirates');
      
      if (!response.ok) {
        throw new Error('Failed to fetch emirates');
      }
      
      const data = await response.json();
      setEmirates(data);
    } catch (error) {
      console.error('Error fetching emirates:', error);
      toast({
        title: 'Error',
        description: 'Failed to load emirates. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmirates();
  }, []);

  const handleSubmit = async (values: z.infer<typeof emirateSchema>) => {
    try {
      setIsSubmitting(true);
      const url = currentEmirate 
        ? `/api/emirates?id=${currentEmirate.id}`
        : '/api/emirates';
      const method = currentEmirate ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save emirate');
      }

      toast({
        title: 'Success',
        description: currentEmirate 
          ? 'Emirate updated successfully' 
          : 'Emirate created successfully',
      });

      await fetchEmirates();
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error saving emirate:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save emirate',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string | number) => {
    try {
      const response = await fetch(`/api/emirates?id=${id}`, {
        method: 'DELETE',
      });
  
      const data = await response.json();
  
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete emirate');
      }
  
      toast({
        title: 'Success',
        description: 'Emirate deleted successfully',
      });
  
      await fetchEmirates();
    } catch (error) {
      console.error('Error deleting emirate:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete emirate',
        variant: 'destructive',
      });
      throw error; // Re-throw to allow DataTable to handle the error
    }
  };

  const columns = [
    {
      key: 'id',
      header: 'ID',
    },
    {
      key: 'name',
      header: 'Name',
    },
  ];

  const formFields = [
    {
      name: 'name',
      label: 'Emirate Name',
      placeholder: 'Enter emirate name',
      description: 'The name of the emirate (e.g., Dubai, Abu Dhabi)',
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <DataTable
        columns={columns}
        data={emirates}
        onAddNew={() => {
          setCurrentEmirate(null);
          setIsDialogOpen(true);
        }}
        onEdit={(emirate) => {
          setCurrentEmirate(emirate);
          setIsDialogOpen(true);
        }}
        onDelete={handleDelete}
        searchKey="name"
        searchPlaceholder="Search emirates..."
        title=""
      />

      <FormDialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCurrentEmirate(null);
          }
          setIsDialogOpen(open);
        }}
        title={currentEmirate ? 'Edit Emirate' : 'Add New Emirate'}
        description={currentEmirate ? 'Update the emirate details' : 'Add a new emirate to the system'}
        fields={formFields}
        initialValues={currentEmirate || { name: '' }}
        onSubmit={handleSubmit}
        schema={emirateSchema}
        isSubmitting={isSubmitting}
        submitButtonText={currentEmirate ? 'Update Emirate' : 'Add Emirate'}
      />
    </div>
  );
}
