"use client";

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Users, ShoppingCart, Utensils, MapPin, Package, Clock, CheckCircle, TrendingUp, PieChart as PieChartIcon } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

// Define types for our data
type DashboardStats = {
  totalEmirates: number;
  totalCustomers: number;
  totalOrders: number;
  totalMenuItems: number;
  recentOrders: Array<{
    id: number;
    customerName: string;
    status: string;
    total: number;
    createdAt: string;
  }>;
  orderStats: Array<{
    date: string;
    orders: number;
    revenue: number;
  }>;
  orderByStatus: Array<{
    status: string;
    count: number;
  }>;
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PROCESSING: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  DELIVERED: 'bg-purple-100 text-purple-800',
};

const statusLabels: Record<string, string> = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  DELIVERED: 'Delivered',
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const response = await fetch('/api/dashboard/stats');
        if (!response.ok) throw new Error('Failed to fetch dashboard data');
        const data = await response.json();
        setStats(data);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const statsCards = [
    {
      title: 'Total Emirates',
      value: stats?.totalEmirates ?? '0',
      icon: <MapPin className="h-6 w-6 text-blue-500" />,
      description: 'Manage emirates',
      link: '/dashboard/emirates',
      color: 'bg-blue-50',
    },
    {
      title: 'Total Customers',
      value: stats?.totalCustomers ?? '0',
      icon: <Users className="h-6 w-6 text-green-500" />,
      description: 'View all customers',
      link: '/dashboard/customers',
      color: 'bg-green-50',
    },
    {
      title: 'Total Orders',
      value: stats?.totalOrders ?? '0',
      icon: <ShoppingCart className="h-6 w-6 text-purple-500" />,
      description: 'View all orders',
      link: '/dashboard/orders',
      color: 'bg-purple-50',
    },
    {
      title: 'Menu Items',
      value: stats?.totalMenuItems ?? '0',
      icon: <Utensils className="h-6 w-6 text-orange-500" />,
      description: 'Manage menu items',
      link: '/dashboard/food/menu-items',
      color: 'bg-orange-50',
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Welcome back! Here's what's happening with your store.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((stat, index) => (
          <Card key={index} className="border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.color}`}>
                {stat.icon}
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
              <a 
                href={stat.link} 
                className="text-sm text-blue-600 hover:underline inline-flex items-center mt-1"
              >
                {stat.description}
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Orders */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold text-gray-900">Recent Orders</CardTitle>
                <CardDescription>Latest 5 orders</CardDescription>
              </div>
              <div className="p-2 rounded-lg bg-blue-50">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-100">
              {stats?.recentOrders?.length ? (
                stats.recentOrders.map((order) => (
                  <div key={order.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">Order #{order.id}</p>
                        <p className="text-sm text-gray-500">{order.customerName}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-semibold text-gray-900">
                          {order.total.toFixed(2)} AED
                        </span>
                        <div className="mt-1">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            statusColors[order.status] || 'bg-gray-100 text-gray-800'
                          }`}>
                            {statusLabels[order.status] || order.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center text-xs text-gray-500">
                      <Clock className="h-3.5 w-3.5 mr-1" />
                      {format(new Date(order.createdAt), 'MMM d, yyyy h:mm a')}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-gray-500">
                  No recent orders found
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Orders by Status */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold text-gray-900">Orders by Status</CardTitle>
                <CardDescription>Distribution of orders</CardDescription>
              </div>
              <div className="p-2 rounded-lg bg-purple-50">
                <PieChartIcon className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="h-[380px] p-4">
            {stats?.orderByStatus?.length ? (
              <div className="flex flex-col h-full">
                <div className="flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.orderByStatus}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="count"
                        label={({ name, percent }: any) => 
                          `${(percent * 100).toFixed(0)}%`
                        }
                      >
                        {stats.orderByStatus.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={COLORS[index % COLORS.length]} 
                          />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number, name: string, props: any) => [
                          value,
                          statusLabels[props.payload.status] || props.payload.status
                        ]}
                      />
                      <Legend 
                        layout="horizontal" 
                        verticalAlign="bottom"
                        formatter={(value) => statusLabels[value] || value}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {stats.orderByStatus.map((status, index) => (
                    <div key={status.status} className="flex items-center">
                      <div 
                        className="w-3 h-3 rounded-full mr-2" 
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-sm text-gray-600">
                        {statusLabels[status.status] || status.status}: {status.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                No order status data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Order Statistics */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold text-gray-900">Order Statistics</CardTitle>
              <CardDescription>Last 7 days order trends</CardDescription>
            </div>
            <div className="p-2 rounded-lg bg-gray-50">
              <TrendingUp className="h-5 w-5 text-gray-600" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="h-[400px] p-6">
          {stats?.orderStats?.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stats.orderStats}
                margin={{
                  top: 5,
                  right: 30,
                  left: 0,
                  bottom: 5,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6b7280' }}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6b7280' }}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    color: '#111827'
                  }}
                  labelStyle={{
                    color: '#6b7280',
                    fontWeight: 500,
                    marginBottom: '4px'
                  }}
                  formatter={(value: number) => [`${value} orders`, 'Orders']}
                  labelFormatter={(label) => `Date: ${label}`}
                />
                <Bar 
                  dataKey="orders" 
                  name="Orders" 
                  radius={[4, 4, 0, 0]}
                >
                  {stats.orderStats.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={
                        index % 2 === 0 ? '#4b5563' : '#9ca3af'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              No order statistics available for the last 7 days
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
