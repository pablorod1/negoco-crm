import React from "react";
import { CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { motion, AnimatePresence } from "framer-motion";
import {
  ColumnDef,
  flexRender,
  type Table as TableType,
} from "@tanstack/react-table";
import { cn } from "@/lib/core/utils";
import { FileX2, Loader2 } from "lucide-react";

interface TableContentProps<TData, TValue> {
  table: TableType<TData>;
  loading: boolean;
  columns: ColumnDef<TData, TValue>[];
}

export function TableContent<TData, TValue>({
  table,
  loading,
  columns,
}: TableContentProps<TData, TValue>) {
  const rows = table.getRowModel().rows;
  const hasRows = rows && rows.length > 0;

  return (
    <CardContent className="p-0 overflow-hidden rounded-xl border border-gray-100 shadow-sm w-full">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-gray-50">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="border-b border-gray-200 hover:bg-transparent"
              >
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="py-3 px-4 text-xs font-semibold text-gray-700 first:pl-6 last:pr-6"
                  >
                    <div className="flex items-center gap-1">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            <AnimatePresence>
              {hasRows ? (
                rows.map((row, index) => (
                  <motion.tr
                    key={row.id}
                    className={cn(
                      "border-b border-gray-100 hover:bg-blue-50/40 transition-colors",
                      index % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                    )}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{
                      duration: 0.2,
                      delay: index * 0.03, // Staggered animation
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className="py-3 px-4 text-sm text-nowrap first:pl-6 last:pr-6"
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </motion.tr>
                ))
              ) : loading ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-[400px] text-center"
                  >
                    <div className="flex flex-col items-center justify-center h-full space-y-4">
                      <div className="relative w-16 h-16">
                        <Loader2 className="w-16 h-16 text-blue-200 animate-spin" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                            <Loader2 className="w-6 h-6 text-white animate-spin" />
                          </div>
                        </div>
                      </div>
                      <div className="text-center space-y-1">
                        <h3 className="text-lg font-medium text-gray-900">
                          Cargando datos
                        </h3>
                        <p className="text-sm text-gray-500">
                          Estamos preparando la información para ti...
                        </p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-[300px] text-center"
                  >
                    <div className="flex flex-col items-center justify-center h-full space-y-4">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                        <FileX2 className="w-8 h-8 text-gray-400" />
                      </div>
                      <div className="text-center space-y-1">
                        <h3 className="text-lg font-medium text-gray-900">
                          No se encontraron resultados
                        </h3>
                        <p className="text-sm text-gray-500">
                          Intenta ajustar los filtros o realizar una nueva
                          búsqueda
                        </p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </AnimatePresence>
          </TableBody>
        </Table>
      </div>

      {/* Table Footer with Pagination */}
      {hasRows && (
        <div className="flex items-center justify-between px-6 py-4 bg-white border-t border-gray-100">
          <div className="text-sm text-gray-500">
            Mostrando <span className="font-medium">{rows.length}</span> de{" "}
            <span className="font-medium">
              {table.getFilteredRowModel().rows.length}
            </span>{" "}
            resultados
          </div>

          <div className="flex items-center space-x-2">
            <button
              className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Anterior
            </button>
            <div className="flex items-center space-x-1">
              {Array.from({ length: table.getPageCount() }, (_, i) => (
                <button
                  key={i}
                  className={cn(
                    "w-8 h-8 text-sm font-medium rounded-md flex items-center justify-center",
                    table.getState().pagination.pageIndex === i
                      ? "bg-blue-600 text-white"
                      : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                  )}
                  onClick={() => table.setPageIndex(i)}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button
              className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </CardContent>
  );
}
