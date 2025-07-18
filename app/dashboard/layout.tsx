'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { LayoutDashboard, Users, ShoppingCart, Truck, Utensils, ChevronDown, ChevronRight, ShoppingBag, Pill , MapPinned , CarTaxiFront , Store, Calendar, CalendarDays, Scissors, Stethoscope, Scale, UtensilsCrossed } from 'lucide-react';
import { Toaster } from '@/components/ui/toaster';

type MenuItem = {
  name: string;
  href: string;
  icon: React.ReactNode;
  children?: MenuItem[];
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    food: false,
    grocery: false,
    medicine: false,
    appointmentservices: false,
    appointments: false,
  });

  const toggleMenu = (menu: string) => {
    setExpandedMenus(prev => ({
      ...prev,
      [menu]: !prev[menu],
    }));
  };

  const menuItems: MenuItem[] = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: <LayoutDashboard size={18} />,
    },
    {
      name: 'Emirates',
      href: '/dashboard/emirates',
      icon: <MapPinned size={18} />,
    },
    {
      name: 'Customers',
      href: '/dashboard/customers',
      icon: <Users size={18} />,
    },
    {
      name: 'Vendors',
      href: '/dashboard/vendors',
      icon: <Store  size={18} />,
    },
    {
      name: 'Orders',
      href: '/dashboard/orders',
      icon: <ShoppingCart size={18} />,
    },
    {
      name: 'Riders & Drivers',
      href: '/dashboard/riders',
      icon: <CarTaxiFront size={18} />,
    },
    {
      name: 'Deliveries',
      href: '/dashboard/deliveries',
      icon: <Truck size={18} />,
    },
    {
      name: 'Food',
      href: '#',
      icon: <Utensils size={18} />,
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
      children: [
        { name: 'All Appointments', href: '/dashboard/appointments', icon: null },
        { name: 'Appointment Types', href: '/dashboard/appointments/appointment-types', icon: null },
      ],
    },
  ];

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
          <h1 className="text-xl font-bold text-gray-800">Admin Panel</h1>
        </div>
        <nav className="flex-1 overflow-y-auto">
          <ul className="p-4 space-y-2">
            {menuItems.map((item) => (
              <li key={item.name}>
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
                        {item.children.map((child) => (
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
            ))}
          </ul>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col ml-72 h-screen">
        {/* Top navigation */}

        {/* Page content */}
        <main className="flex-1 p-6">
          {children}
          <Toaster />
        </main>
      </div>
    </div>
  );
}
