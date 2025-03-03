import { Table } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface DataTablePaginationProps<TData> {
  table: Table<TData>;
}

export function DataTablePagination<TData>({
  table,
}: DataTablePaginationProps<TData>) {
  return (
    <div className="flex items-center justify-center">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          <ChevronLeft />
        </Button>

        {/* Números de página */}
        {table.getPageCount() > 0 &&
          Array.from(Array(table.getPageCount()).keys()).map((pageIndex) => (
            <Button
              key={pageIndex}
              variant="ghost"
              size="sm"
              className={`w-8 h-8 rounded-lg ${
                table.getState().pagination.pageIndex === pageIndex
                  ? "bg-[var(--primary-color-500)] text-white shadow-lg hover:bg-[var(--primary-color-600)] hover:text-white"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
              onClick={() => table.setPageIndex(pageIndex)}
            >
              {pageIndex + 1}
            </Button>
          ))}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
