import { Emirates } from "@prisma/client";

export type OrderStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "PREPARING" | "DELIVERED";

export interface Customer {
  id: number;
  name: string;
  phone: string;
}

export interface Outlet {
  id: number;
  name: string;
}

export interface OrderItem {
  id: number;
  menuItem: {
    id: number;
    name: string;
  };
  quantity: number;
  price: number;
}

export interface Order {
  id: number;
  customerId: number;
  emiratesId: number;
  orderType: string;
  outletId: number;
  deliveryAddress: string | null;
  deliveryLocation: string | null;
  buildingType: string | null;
  paymentMethod: string;
  note: string | null;
  status: OrderStatus;
  category: string | null;
  subtotal: number;
  serviceFee: number;
  deliveryFee: number;
  vat: number;
  total: number;
  createdAt: string;
  updatedAt: string;
  customer: Customer;
  emirates: Emirates;
  outlet: Outlet;
  items: OrderItem[];
}

export interface ColumnDef<T> {
  accessorKey: keyof T | string;
  header: string;
  cell?: (info: any) => React.ReactNode;
  className?: string;
}
