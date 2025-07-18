export type DeliveryStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'IN_TRANSIT' | 'DELIVERED';

export interface Customer {
  id: number;
  name: string;
  whatsappNumber: string;
}

export interface Rider {
  id: number;
  name: string;
  phone: string;
  liveLocation?: string;
}

export interface Emirate {
  id: number;
  name: string;
}

export interface Order {
  id: number;
  customer: Customer;
}

export interface Delivery {
  id: number;
  orderId: number;
  order: Order;
  riderId: number | null;
  rider: Rider | null;
  emirateId: number;
  emirate: Emirate;
  status: DeliveryStatus;
  createdAt: string;
  updatedAt: string;
  riderName: string;
  riderPhone: string;
  customerName: string;
  customerPhone: string;
  emirateName: string;
  riderLiveLocation?: string;
}
