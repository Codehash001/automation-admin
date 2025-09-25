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

// Helper to format order type nicely (e.g., SELF_PICK_UP -> Self Pick Up)
const formatOrderType = (val: string | null | undefined) => {
  if (!val) return 'N/A';
  return val
    .toString()
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
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
        <div className="text-sm text-gray-500">
          {(row.original as any)?.customer?.whatsappNumber || row.original.customer?.phone || 'N/A'}
        </div>
      </div>
    ),
  },
  {
    accessorKey: 'outlet',
    header: 'Outlet',
    cell: ({ row }) => {
      const o: any = row.original as any;
      const outletName =
        o?.outlet?.name ||
        o?.groceryStore?.name ||
        o?.medicalStore?.name ||
        // possible alternate keys if API flattened
        o?.store?.name ||
        o?.storeName ||
        o?.outletName ||
        'N/A';
      return outletName;
    },
  },
  {
    accessorKey: 'items',
    header: 'Items',
    cell: ({ row }) => {
      // Prefer whichever item array has content based on category
      const o: any = row.original as any;
      const foodItems = o?.items || [];
      const groceryItems = o?.groceryItems || [];
      const medicineItems = o?.medicineItems || [];

      const chosenItems = foodItems.length
        ? foodItems
        : groceryItems.length
        ? groceryItems
        : medicineItems;

      if (!chosenItems || chosenItems.length === 0) return 'N/A';

      return (
        <div className="space-y-1">
          {chosenItems.map((item: any) => {
            const qty = toNumber(item?.quantity) || 0;
            const itemName =
              // food
              item?.menuItem?.name ||
              item?.foodMenuItem?.name ||
              // grocery
              item?.groceryMenuItem?.name ||
              // medicine
              item?.medicineMenuItem?.name ||
              // sometimes APIs flatten
              item?.name ||
              'Unknown Item';
            return (
              <div key={item.id} className="text-sm">
                {qty}x {itemName}
              </div>
            );
          })}
        </div>
      );
    },
  },
  // Subtotal column added before Total
  {
    accessorKey: 'subtotal',
    header: 'Subtotal',
    cell: ({ row }) => {
      // Use provided subtotal if available; otherwise compute from whichever item array has content
      const o: any = row.original as any;
      const provided = o?.subtotal;

      const foodItems = o?.items || [];
      const groceryItems = o?.groceryItems || [];
      const medicineItems = o?.medicineItems || [];

      const chosenItems = foodItems.length
        ? foodItems
        : groceryItems.length
        ? groceryItems
        : medicineItems;

      const computed = (chosenItems || []).reduce((sum: number, item: any) => {
        return sum + toNumber(item?.price) * (toNumber(item?.quantity) || 0);
      }, 0);

      const val = toNumber(provided ?? computed);
      return `AED ${val.toFixed(2)}`;
    },
  },
  {
    accessorKey: 'total',
    header: 'Total',
    cell: ({ row }) => {
      const total = toNumber((row.original as any)?.total);
      return `AED ${total.toFixed(2)}`;
    },
  },
  {
    accessorKey: 'category',
    header: 'Category',
    cell: ({ row }) => {
      const categoryRaw = (row.original as any)?.category as string | null;
      const orderTypeRaw = (row.original as any)?.orderType as string | null;
      const category = (categoryRaw || 'N/A').toString().toLowerCase();
      const orderType = formatOrderType(orderTypeRaw || '');
      return (
        <div className="flex flex-col">
          <span className="font-medium">{category}</span>
          {orderType && orderType !== 'N/A' && (
            <span className="text-xs text-gray-500">{orderType}</span>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: 'location',
    header: 'Location',
    cell: ({ row }) => {
      const location = (row.original as any)?.deliveryLocation;
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
      <Badge className={statusVariant[(row.original as any).status as keyof typeof statusVariant]}>
        {(row.original as any).status}
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
    cell: ({ row }) => format(new Date((row.original as any).createdAt), 'PPpp'),
  },
  {
    id: 'actions',
    cell: ({ row, column }) => {
      const order = row.original as any;
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
