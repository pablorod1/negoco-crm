import React, { useRef } from "react";
import { CardContent } from "@/core/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/core/components/ui/table";
import {
  ColumnDef,
  flexRender,
  type Table as TableType,
} from "@tanstack/react-table";
import { DataTablePagination } from "./DataTablePagination";
import LoaderComponent from "../LoaderComponent";
import { useVirtualizer } from "@tanstack/react-virtual";

interface TableContentProps<TData, TValue> {
  table: TableType<TData>;
  loading: boolean;
  columns: ColumnDef<TData, TValue>[];
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
  rowsPerPage,
  pageIndex,
  setPageIndex,
  setPageSize,
  total,
}: TableContentProps<TData, TValue>) {
  const rows = table.getRowModel().rows;
  const hasRows = rows && rows.length > 0;
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 52,
    overscan: 8,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const topPadding = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const bottomPadding =
    virtualRows.length > 0
      ? rowVirtualizer.getTotalSize() -
        virtualRows[virtualRows.length - 1].end
      : 0;

  return (
    <CardContent className="p-0 overflow-hidden w-full">
      <div
        ref={scrollContainerRef}
        className="max-h-[65vh] overflow-auto"
      >
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
                            header.getContext(),
                          )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {hasRows ? (
              <>
                {topPadding > 0 && (
                  <TableRow aria-hidden="true" className="border-0">
                    <TableCell
                      colSpan={columns.length}
                      className="p-0"
                      style={{ height: `${topPadding}px` }}
                    />
                  </TableRow>
                )}
                {virtualRows.map((virtualRow) => {
                  const row = rows[virtualRow.index];

                  return (
                  <TableRow
                    key={row.id}
                    ref={rowVirtualizer.measureElement}
                    data-index={virtualRow.index}
                    className="group cursor-default border-b border-gray-50 bg-white transition-colors duration-150 hover:bg-gray-50/30"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className="py-3 px-4 text-sm text-gray-800 first:pl-6 last:pr-6"
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                  );
                })}
                {bottomPadding > 0 && (
                  <TableRow aria-hidden="true" className="border-0">
                    <TableCell
                      colSpan={columns.length}
                      className="p-0"
                      style={{ height: `${bottomPadding}px` }}
                    />
                  </TableRow>
                )}
              </>
            ) : (
              <TableRow className="bg-white">
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
              </TableRow>
            )}
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
