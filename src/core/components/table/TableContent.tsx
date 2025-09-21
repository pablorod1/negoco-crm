import React from "react";
import { CardContent } from "@/core/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/core/components/ui/table";
import { motion, AnimatePresence } from "framer-motion";
import {
  ColumnDef,
  flexRender,
  type Table as TableType,
} from "@tanstack/react-table";
import { cn } from "@/core/utils";
import { DataTablePagination } from "./DataTablePagination";
import LoaderComponent from "../LoaderComponent";

interface TableContentProps<TData, TValue> {
  table: TableType<TData>;
  loading: boolean;
  columns: ColumnDef<TData, TValue>[];
  rowsPerPage: number | string;
  pageIndex: number;
  setPageIndex: (pageIndex: number) => void;
  setPageSize: (pageSize: number | string) => void;
  total: number;
}

export function TableContent<TData, TValue>({
  table,
  loading,
  columns,
  rowsPerPage,
  pageIndex,
  setPageIndex,
  setPageSize,
  total,
}: TableContentProps<TData, TValue>) {
  const rows = table.getRowModel().rows;
  const hasRows = rows && rows.length > 0;

  return (
    <CardContent className="p-0 overflow-hidden w-full">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-gray-50/60 border-b border-gray-100">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wide first:pl-6 last:pr-6"
                  >
                    <div className="flex items-center gap-2">
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
                      "border-b border-gray-50 hover:bg-gray-50/30 transition-all duration-200 cursor-default group",
                      "bg-white"
                    )}
                    initial={{ opacity: 0, y: 2 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -2 }}
                    transition={{
                      duration: 0.15,
                      delay: index * 0.01,
                      ease: "easeOut",
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className="py-3 px-4 text-sm text-gray-800 first:pl-6 last:pr-6"
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
                <motion.tr
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-white"
                >
                  <TableCell
                    colSpan={columns.length}
                    className="h-64 text-center"
                  >
                    {loading ? (
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <LoaderComponent />
                        <div className="space-y-1 text-center">
                          <p className="text-gray-600 text-sm font-medium">
                            Cargando datos...
                          </p>
                          <p className="text-gray-400 text-xs">
                            Por favor espera un momento
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center space-y-4">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                          <svg
                            className="w-6 h-6 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                        </div>
                        <div className="space-y-1 text-center">
                          <p className="text-gray-700 font-medium text-sm">
                            No hay datos disponibles
                          </p>
                          <p className="text-gray-500 text-xs max-w-xs">
                            No se encontraron registros que coincidan con los
                            criterios actuales
                          </p>
                        </div>
                      </div>
                    )}
                  </TableCell>
                </motion.tr>
              )}
            </AnimatePresence>
          </TableBody>
        </Table>
      </div>
      <div className="border-t border-gray-100 bg-gray-50/20 py-3">
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
