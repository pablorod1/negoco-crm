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
import Image from "next/image";
import LoadingComponent from "@/components/documentacion/LoadingComponent";
import { User } from "@/lib/core/types";
import { DataTablePagination } from "./DataTablePagination";

interface TableContentProps<TData, TValue> {
  table: TableType<TData>;
  loading: boolean;
  columns: ColumnDef<TData, TValue>[];
  userData: User;
  rowsPerPage: number;
  pageIndex: number;
  setPageIndex: (pageIndex: number) => void;
  setPageSize: (pageSize: number) => void;
  total: number;
}

export function TableContent<TData, TValue>({
  table,
  loading,
  columns,
  userData,
  rowsPerPage,
  pageIndex,
  setPageIndex,
  setPageSize,
  total,
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
                    className="h-[300px] text-center"
                  >
                    <LoadingComponent userData={userData} />
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
                        <Image
                          src="/icons/tramite.webp"
                          alt="Empty"
                          width={64}
                          height={64}
                        />
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

      <div className="py-6">
        <DataTablePagination
          rowsPerPage={rowsPerPage}
          total={total}
          pageIndex={pageIndex}
          setPageIndex={setPageIndex}
          setPageSize={setPageSize}
        />
      </div>
    </CardContent>
  );
}
