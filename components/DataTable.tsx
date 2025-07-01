'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Pencil, Trash2, Plus } from 'lucide-react';

type Column = {
  key: string;
  header: string;
  render?: (value: any) => React.ReactNode;
};

type DataTableProps = {
  columns: Column[];
  data: any[];
  onEdit: (item: any) => void;
  onDelete: (id: string | number) => Promise<void>;
  onAddNew: () => void;
  searchKey?: string;
  searchPlaceholder?: string;
  title: string;
  addButtonText?: string;
};

export function DataTable({
  columns,
  data,
  onEdit,
  onDelete,
  onAddNew,
  searchKey,
  searchPlaceholder = 'Search...',
  title,
  addButtonText = 'Add New',
}: DataTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredData, setFilteredData] = useState(data);
  const [isDeleting, setIsDeleting] = useState<number | string | null>(null);

  useEffect(() => {
    if (!searchKey || !searchTerm) {
      setFilteredData(data);
      return;
    }

    const filtered = data.filter((item) =>
      String(item[searchKey]).toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredData(filtered);
  }, [searchTerm, data, searchKey]);

  const handleDelete = async (id: string | number) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      try {
        setIsDeleting(id);
        await onDelete(id);
      } catch (error) {
        console.error('Error deleting item:', error);
      } finally {
        setIsDeleting(null);
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold">{title}</h2>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          {searchKey && (
            <Input
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-64"
            />
          )}
          <Button onClick={onAddNew} className="whitespace-nowrap">
            <Plus className="mr-2 h-4 w-4" />
            {addButtonText}
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.key}>{column.header}</TableHead>
              ))}
              <TableHead className="w-[100px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.length > 0 ? (
              filteredData.map((item) => (
                <TableRow key={item.id}>
                  {columns.map((column) => (
                    <TableCell key={`${item.id}-${column.key}`}>
                      {column.render
                        ? column.render(item[column.key])
                        : String(item[column.key] || '-')}
                    </TableCell>
                  ))}
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit(item)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(item.id)}
                          disabled={isDeleting === item.id}
                          className="text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {isDeleting === item.id ? 'Deleting...' : 'Delete'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length + 1}
                  className="h-24 text-center"
                >
                  No results found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

