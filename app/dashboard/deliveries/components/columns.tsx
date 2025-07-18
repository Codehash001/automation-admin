import { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { MoreHorizontal, ArrowUpDown, MapPin } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Delivery, DeliveryStatus } from '../types';

const statusVariant = {
  PENDING: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200',
  ACCEPTED: 'bg-blue-100 text-blue-800 hover:bg-blue-200',
  IN_TRANSIT: 'bg-purple-100 text-purple-800 hover:bg-purple-200',
  DELIVERED: 'bg-green-100 text-green-800 hover:bg-green-200',
  REJECTED: 'bg-red-100 text-red-800 hover:bg-red-200',
} as const;

export const columns: ColumnDef<Delivery>[] = [
  {
    accessorKey: 'id',
    header: 'Delivery ID',
  },
  {
    accessorKey: 'orderId',
    header: 'Order ID',
  },
  {
    accessorKey: 'customer',
    header: 'Customer',
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{row.original.customerName}</div>
        <div className="text-sm text-gray-500">{row.original.customerPhone}</div>
      </div>
    ),
  },
  {
    accessorKey: 'rider',
    header: 'Rider',
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{row.original.riderName}</div>
        <div className="text-sm text-gray-500">{row.original.riderPhone}</div>
      </div>
    ),
  },
  {
    accessorKey: 'riderLiveLocation',
    header: 'Live Location',
    cell: ({ row }) => {
      if (!row.original.riderLiveLocation) {
        return <span className="text-gray-400">No location</span>;
      }
      return (
        <a 
          href={row.original.riderLiveLocation} 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center text-blue-600 hover:text-blue-800"
        >
          <MapPin className="h-4 w-4 mr-1" />
          View Location
        </a>
      );
    },
  },
  {
    accessorKey: 'emirate',
    header: 'Emirate',
    cell: ({ row }) => row.original.emirateName,
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
        Created
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => format(new Date(row.original.createdAt), 'PPpp'),
  },
  {
    accessorKey: 'updatedAt',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Updated
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => format(new Date(row.original.updatedAt), 'PPpp'),
  },
  {
    id: 'actions',
    cell: ({ row, column }) => {
      const delivery = row.original;
      const statuses: DeliveryStatus[] = ['ACCEPTED', 'IN_TRANSIT', 'DELIVERED', 'REJECTED'];
      const onStatusUpdate = (column.columnDef.meta as any)?.onStatusUpdate as (id: number, status: DeliveryStatus) => void;
      
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
                onClick={() => onStatusUpdate?.(delivery.id, status)}
                disabled={delivery.status === status}
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
