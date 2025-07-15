'use client';

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "./components/data-table";
import { columns } from "./components/columns";
import { Delivery, DeliveryStatus } from "./types";

export default function DeliveriesPage() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDeliveries = async () => {
      try {
        const response = await fetch('/api/deliveries');
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch deliveries: ${response.status} ${errorText}`);
        }
        const data = await response.json();
        
        // Transform the data to match the expected format
        const formattedDeliveries = data.map((delivery: any) => {
          return {
            ...delivery,
            orderId: delivery.order?.id || 'N/A',
            customerName: delivery.order?.customer?.name || 'N/A',
            customerPhone: delivery.order?.customer?.whatsappNumber || 'N/A',
            riderName: delivery.driver?.name || 'N/A',
            riderPhone: delivery.driver?.phone || 'N/A',
            emirateName: delivery.order?.emirates?.name || 'N/A',
            createdAt: delivery.createdAt ? new Date(delivery.createdAt).toLocaleString() : 'N/A',
            updatedAt: delivery.updatedAt ? new Date(delivery.updatedAt).toLocaleString() : 'N/A',
          };
        });
        
        setDeliveries(formattedDeliveries);
      } catch (error) {
        console.error(error);
        setError(error instanceof Error ? error.message : 'Failed to fetch deliveries');
      } finally {
        setLoading(false);
      }
    };

    fetchDeliveries();
  }, []);

  const handleStatusUpdate = async (id: number, status: DeliveryStatus) => {
    try {
      const response = await fetch(`/api/deliveries?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      
      if (!response.ok) throw new Error('Failed to update delivery status');
      
      // Update the local state to reflect the change
      setDeliveries(prevDeliveries => 
        prevDeliveries.map(delivery => 
          delivery.id === id ? { ...delivery, status } : delivery
        )
      );
    } catch (error) {
      console.error('Error updating delivery status:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Deliveries</h1>
        <Button variant="outline" onClick={() => window.location.reload()}>Refresh</Button>
      </div>
      
      <Card className="flex-1 flex flex-col">
        <CardHeader className="border-b">
          <CardTitle>Recent Deliveries</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 p-2">
          <DataTable 
            columns={columns} 
            data={deliveries} 
            onStatusUpdate={handleStatusUpdate}
          />
        </CardContent>
      </Card>
    </div>
  );
}