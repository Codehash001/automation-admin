'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, Fragment } from 'react';
import { LayoutDashboard, Users, ShoppingCart, Truck, Utensils, ChevronDown, ChevronRight, ShoppingBag, Pill , MapPinned , CarTaxiFront , Store, Calendar, CalendarDays, Scissors, Stethoscope, Scale, UtensilsCrossed, LogOut, User, Shield, Settings } from 'lucide-react';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/roles';

type MenuItem = {
  name: string;
  href: string;
  icon: React.ReactNode;
  children?: MenuItem[];
};



function DashboardContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, logout, canAccessResource, loading } = useAuth();
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    food: false,
    grocery: false,
    medicine: false,
    appointmentservices: false,
    appointments: false,
  });

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated (this should be handled by middleware, but as fallback)
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Please log in to access the dashboard.</p>
          <Button onClick={() => window.location.href = '/login'}>Go to Login</Button>
        </div>
      </div>
    );
  }

  const toggleMenu = (menu: string) => {
    setExpandedMenus(prev => ({
      ...prev,
      [menu]: !prev[menu],
    }));
  };

  // Define all menu items with resource permissions
  const allMenuItems: (MenuItem & { resource?: string })[] = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: <LayoutDashboard size={18} />,
      resource: 'dashboard',
    },
    {
      name: 'Emirates',
      href: '/dashboard/emirates',
      icon: <MapPinned size={18} />,
      resource: 'emirates',
    },
    {
      name: 'Customers',
      href: '/dashboard/customers',
      icon: <Users size={18} />,
      resource: 'customers',
    },
    {
      name: 'Vendors',
      href: '/dashboard/vendors',
      icon: <Store  size={18} />,
      resource: 'vendors',
    },
    {
      name: 'Orders',
      href: '/dashboard/orders',
      icon: <ShoppingCart size={18} />,
      resource: 'orders',
    },
    {
      name: 'Riders & Drivers',
      href: '/dashboard/riders-and-drivers',
      icon: <CarTaxiFront size={18} />,
      resource: 'riders',
      children: [
        { name: 'Delivery Riders', href: '/dashboard/riders-and-drivers/delivery-riders', icon: null },
        { name: 'Drivers', href: '/dashboard/riders-and-drivers/drivers', icon: null },
        { name: 'Vehicle Types', href: '/dashboard/riders-and-drivers/drivers-vehicle-types', icon: null },
      ],
    },
    {
      name: 'Deliveries',
      href: '/dashboard/deliveries',
      icon: <Truck size={18} />,
      resource: 'deliveries',
    },
    {
      name: 'Passenger Rides',
      href: '/dashboard/passenger-rides',
      icon: <CarTaxiFront size={18} />,
    },
    {
      name: 'Food',
      href: '#',
      icon: <Utensils size={18} />,
      resource: 'food',
      children: [
        { name: 'Cuisines', href: '/dashboard/food/cuisines', icon: null },
        { name: 'Outlets', href: '/dashboard/food/outlets', icon: null },
        { name: 'Menu', href: '/dashboard/food/menus', icon: null },
        { name: 'Menu Items', href: '/dashboard/food/menu-items', icon: null },
      ],
    },
    {
      name: 'Grocery',
      href: '#',
      icon: <ShoppingBag size={18} />,
      resource: 'grocery',
      children: [
        { name: 'Stores', href: '/dashboard/grocery/stores', icon: null },
        { name: 'Menu', href: '/dashboard/grocery/menus', icon: null },
        { name: 'Menu Items', href: '/dashboard/grocery/menu-items', icon: null },
      ],
    },
    {
      name: 'Medicine',
      href: '#',
      icon: <Pill size={18} />,
      resource: 'medicine',
      children: [
        { name: 'Stores', href: '/dashboard/medicine/stores', icon: null },
        { name: 'Menu', href: '/dashboard/medicine/menus', icon: null },
        { name: 'Menu Items', href: '/dashboard/medicine/menu-items', icon: null },
      ],
    },
    {
      name: 'Appointment Services',
      href: '#',
      icon: <Calendar size={18} />,
      resource: 'appointments',
      children: [
        { name: 'Salon', href: '/dashboard/appointments/appointment-services/salon', icon: <Scissors size={16} /> },
        { name: 'Doctor', href: '/dashboard/appointments/appointment-services/doctor', icon: <Stethoscope size={16} /> },
        { name: 'Legal', href: '/dashboard/appointments/appointment-services/legal', icon: <Scale size={16} /> },
        { name: 'Restaurants', href: '/dashboard/appointments/appointment-services/restaurants', icon: <UtensilsCrossed size={16} /> },
      ],
    },
    {
      name: 'Appointments',
      href: '#',
      icon: <CalendarDays size={18} />,
      resource: 'appointments',
      children: [
        { name: 'All Appointments', href: '/dashboard/appointments/all', icon: null },
        { name: 'Appointment Types', href: '/dashboard/appointments/appointment-types', icon: null },
      ],
    },
    {
      name: 'Settings',
      href: '/dashboard/settings',
      icon: <Settings size={18} />,
      resource: 'settings',
    },
  ];

  // Filter menu items based on user permissions
  const menuItems = allMenuItems.filter((item: any) => {
    if (!item.resource) return true; // Show items without resource requirements
    return canAccessResource(item.resource);
  });

  const isActive = (href: string) => {
    if (href === '/dashboard' && pathname === '/dashboard') {
      return true;
    }
    return href !== '/dashboard' && pathname.startsWith(href);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Fixed Sidebar */}
      <div className="w-72 bg-white border-r border-gray-200 flex flex-col h-screen fixed left-0 top-0">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-800">Haabibi</h1>
          <h1 className="text-sm font-medium text-gray-800">Admin Panel</h1>
        </div>
        

        <nav className="flex-1 overflow-y-auto">
          <ul className="p-4 space-y-2">
            {menuItems.map((item: any) => (
              <Fragment key={item.name}>
              <li>
                {item.children ? (
                  <>
                    <button
                      onClick={() => toggleMenu(item.name.toLowerCase().replace(' ', ''))}
                      className={`w-full flex items-center justify-between p-2 rounded-md hover:bg-gray-100 ${
                        isActive(item.href) ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                      }`}
                    >
                      <div className="flex items-center">
                        {item.icon && <span className="mr-3">{item.icon}</span>}
                        <span>{item.name}</span>
                      </div>
                      {expandedMenus[item.name.toLowerCase().replace(' ', '')] ? (
                        <ChevronDown size={16} />
                      ) : (
                        <ChevronRight size={16} />
                      )}
                    </button>
                    {expandedMenus[item.name.toLowerCase().replace(' ', '')] && (
                      <ul className="ml-6 mt-1 space-y-1">
                        {item.children.map((child: any) => (
                          <li key={child.name}>
                            <Link
                              href={child.href}
                              className={`flex items-center p-2 text-sm rounded-md ${
                                isActive(child.href)
                                  ? 'bg-blue-50 text-blue-600 font-medium'
                                  : 'text-gray-600 hover:bg-gray-100'
                              }`}
                            >
                              {child.icon && <span className="mr-2">{child.icon}</span>}
                              {child.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : (
                  <Link
                    href={item.href}
                    className={`flex items-center p-2 rounded-md ${
                      isActive(item.href)
                        ? 'bg-blue-50 text-blue-600 font-medium'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {item.icon && <span className="mr-3">{item.icon}</span>}
                    <span>{item.name}</span>
                  </Link>
                )}
              </li>
              {/* Separators between logical groups */}
              {['Riders & Drivers', 'Appointments', 'Appointment Services'].includes(item.name) && (
                <li aria-hidden="true" className="px-2">
                  <div className="my-3 border-t border-gray-200" />
                </li>
              )}
              </Fragment>
            ))}
          </ul>
        </nav>
                {/* User Info */}
                <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user.name}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {user.email}
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <Badge className={`text-xs ${user?.role ? ROLE_COLORS[user.role as keyof typeof ROLE_COLORS] || 'bg-gray-100 text-gray-800' : 'bg-gray-100 text-gray-800'}`}>
              <Shield className="w-3 h-3 mr-1" />
              {user?.role ? ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] || user.role : 'User'}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="text-gray-500 hover:text-red-600 p-1"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col ml-72 h-screen">
        {/* Top navigation */}
        <div className="bg-white px-6 py-4 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div>
              <p className=" text-gray-500 mb-1">
                Welcome back, {user.name}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <Badge className={`${ROLE_COLORS[user.role as keyof typeof ROLE_COLORS]}`}>
                {ROLE_LABELS[user.role as keyof typeof ROLE_LABELS]}
              </Badge>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 p-6">
          {children}
          <Toaster />
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <DashboardContent>{children}</DashboardContent>
    </AuthProvider>
  );
}
