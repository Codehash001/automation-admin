import { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { MoreHorizontal, ArrowUpDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Order, OrderStatus, OrderItem } from '../types';

// Helper type for Prisma Decimal
interface PrismaDecimal {
  toNumber: () => number;
  toString: () => string;
  [key: string]: any;
}

// Helper function to safely convert any value to number
const toNumber = (value: number | string | PrismaDecimal | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value) || 0;
  if (typeof value === 'object' && 'toNumber' in value) {
    return value.toNumber();
  }
  return 0;
};

const statusVariant = {
  PENDING: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200',
  ACCEPTED: 'bg-blue-100 text-blue-800 hover:bg-blue-200',
  PREPARING: 'bg-purple-100 text-purple-800 hover:bg-purple-200',
  DELIVERED: 'bg-green-100 text-green-800 hover:bg-green-200',
  REJECTED: 'bg-red-100 text-red-800 hover:bg-red-200',
} as const;

export const columns: ColumnDef<Order>[] = [
  {
    accessorKey: 'id',
    header: 'Order ID',
  },
  {
    accessorKey: 'customer',
    header: 'Customer',
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{row.original.customer?.name || 'N/A'}</div>
        <div className="text-sm text-gray-500">{row.original.customer?.phone || 'N/A'}</div>
      </div>
    ),
  },
  {
    accessorKey: 'outlet',
    header: 'Outlet',
    cell: ({ row }) => row.original.outlet?.name || 'N/A',
  },
  {
    accessorKey: 'items',
    header: 'Items',
    cell: ({ row }) => (
      <div className="space-y-1">
        {row.original.items?.map((item: OrderItem) => {
          const price = toNumber(item.price);
          return (
            <div key={item.id} className="flex justify-between">
              <span>
                {item.quantity}x {item.menuItem?.name || 'Unknown Item'}
              </span>
              <span className="ml-4">AED {price.toFixed(2)}</span>
            </div>
          );
        })}
      </div>
    ),
  },
  {
    accessorKey: 'total',
    header: 'Total',
    cell: ({ row }) => {
      const total = toNumber(row.original.total);
      return `AED ${total.toFixed(2)}`;
    },
  },
  {
    accessorKey: 'category',
    header: 'Category',
    cell: ({ row }) => {
      const category = row.getValue("category") as string | null;
      return <div className="font-medium">{category || 'N/A'}</div>;
    },
  },
  {
    accessorKey: 'location',
    header: 'Location',
    cell: ({ row }) => {
      const location = row.original.deliveryLocation;
      if (!location) return 'N/A';
      
      const [lat, lng] = location.split(',').map(Number);
      const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
      
      return (
        <a 
          href={mapsUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          View on Map
        </a>
      );
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <Badge className={statusVariant[row.original.status as keyof typeof statusVariant]}>
        {row.original.status}
      </Badge>
    ),
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Date
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => format(new Date(row.original.createdAt), 'PPpp'),
  },
  {
    id: 'actions',
    cell: ({ row, column }) => {
      const order = row.original;
      const statuses: OrderStatus[] = ['ACCEPTED', 'PREPARING', 'DELIVERED', 'REJECTED'];
      const onStatusUpdate = (column.columnDef.meta as any)?.onStatusUpdate as (id: number, status: OrderStatus) => void;
      
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            {statuses.map((status) => (
              <DropdownMenuItem
                key={status}
                onClick={() => onStatusUpdate?.(order.id, status)}
                disabled={order.status === status}
              >
                Mark as {status}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
