'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from './components/data-table';
import { columns } from './components/columns';
import { Order, OrderStatus } from './types';

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await fetch('/api/order');
      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }
      const data = await response.json();
      
      // Transform the data to match the expected format
      const formattedOrders = data.map((order: any) => {
        // Format delivery location as a Google Maps link if it exists
        const locationLink = order.deliveryLocation
          ? `https://www.google.com/maps?q=${order.deliveryLocation}`
          : null;
          
        // Calculate total from items if not available
        const total = order.total || 
          (order.items?.reduce((sum: number, item: any) => {
            return sum + (item.quantity * (item.price || item.menuItem?.price || 0));
          }, 0) || 0);
          
        return {
          ...order,
          orderType: order.orderType || 'N/A',
          category: order.category || 'N/A',
          customerName: order.customer?.name || 'N/A',
          customerPhone: order.customer?.whatsappNumber || 'N/A',
          total: typeof total === 'number' ? total : parseFloat(total?.toString() || '0'),
          createdAt: order.createdAt ? new Date(order.createdAt).toLocaleString() : 'N/A',
          locationLink,
          // Ensure items is always an array
          items: Array.isArray(order.items) ? order.items : []
        };
      });
      
      setOrders(formattedOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (id: number, status: OrderStatus) => {
    try {
      const response = await fetch(`/api/order?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      
      if (!response.ok) throw new Error('Failed to update order status');
      
      // Update the local state to reflect the change
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order.id === id ? { ...order, status } : order
        )
      );
    } catch (error) {
      console.error('Error updating order status:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
      </div>
      
      <Card className="flex-1 flex flex-col">
        <CardHeader className="border-b">
          <CardTitle>Recent Orders</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 p-0">
          <DataTable 
            columns={columns} 
            data={orders} 
            onStatusUpdate={handleStatusUpdate} 
          />
        </CardContent>
      </Card>
    </div>
  );
}
