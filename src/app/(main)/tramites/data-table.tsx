"use client";

import { useState } from "react";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  ColumnFiltersState,
  getFilteredRowModel,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FilterX, Search } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { DataTablePagination } from "./data-table-pagination";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
}

export function DataTable<TData, TValue>({
  columns,
  data,
}: DataTableProps<TData, TValue>) {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    onPaginationChange: setPagination,
    state: {
      sorting,
      columnFilters,
      pagination,
    },
  });

  return (
    <Card className="w-full shadow-lg">
      <CardHeader className="space-y-6 pb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar por CUPS, cliente, comercial..."
              value={
                (table.getColumn("CUPS")?.getFilterValue() as string) ?? ""
              }
              onChange={(event) =>
                table.getColumn("CUPS")?.setFilterValue(event.target.value)
              }
              className="pl-10 w-full bg-white border-gray-200 focus:ring-2 focus:ring-primary-500 transition-all duration-300"
            />
          </div>
          <div className="flex flex-wrap gap-3 items-center justify-end">
            <Button
              variant="outline"
              className=" border-[var(--danger-color)] text-[var(--danger-color)] hover:text-white hover:bg-[var(--danger-color)] transition-colors duration-300"
              onClick={() => {
                setColumnFilters([]);
              }}
            >
              <FilterX className="h-4 w-4" />
            </Button>
            <Select defaultValue="all">
              <SelectTrigger className="w-full sm:w-48 bg-gray-100 border-0 focus:ring-2 focus:ring-primary-500 transition-all duration-300">
                <SelectValue placeholder="Compañía" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">Todas las compañías</SelectItem>
                  <SelectItem value="eleia">Eleia</SelectItem>
                  <SelectItem value="acciona">Acciona</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <Select defaultValue="all">
              <SelectTrigger className="w-full sm:w-44 bg-gray-100 border-0 focus:ring-2 focus:ring-primary-500 transition-all duration-300">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="paid">Cobrado</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <Select defaultValue="all">
              <SelectTrigger className="w-full sm:w-[180px] bg-gray-100 border-0 focus:ring-2 focus:ring-primary-500 transition-all duration-300">
                <SelectValue placeholder="Tipo de contrato" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">Todos los contratos</SelectItem>
                  <SelectItem value="change">Cambio Compañía</SelectItem>
                  <SelectItem value="new">Nuevo Contrato</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-sm text-gray-500">
          <span className="font-medium">
            {table.getFilteredRowModel().rows.length} trámites
          </span>
          <div className="flex items-center gap-2 mt-2 sm:mt-0">
            Filas por página:
            <Select
              value={pagination.pageSize.toString()}
              onValueChange={(value) =>
                setPagination(() => ({
                  pageIndex: 0, // Reset to first page when changing page size
                  pageSize: Number(value),
                }))
              }
            >
              <SelectTrigger className="w-[70px] h-8 focus:ring-2 focus:ring-primary-500 transition-all duration-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="30">30</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="border-t">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className={`py-2 text-xs font-bold  border-0 ${
                        header.column.columnDef.header === "Creación"
                          ? "px-0"
                          : "px-4"
                      }`}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row, index) => (
                  <motion.tr
                    key={row.id}
                    className={`${
                      index % 2 === 0
                        ? "bg-[var(--primary-color-50)]"
                        : "bg-white"
                    } border-b `}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className="p-4 text-sm text-nowrap"
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </motion.tr>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center text-gray-500"
                  >
                    No se encontraron resultados
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <DataTablePagination table={table} />
    </Card>
  );
}
