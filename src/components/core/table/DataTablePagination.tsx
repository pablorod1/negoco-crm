import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DataTablePaginationProps {
  total: number;
  rowsPerPage: number | string;
  pageIndex: number;
  setPageIndex: (pageIndex: number) => void;
  setPageSize: (pageSize: number | string) => void;
}

export function DataTablePagination({
  total,
  rowsPerPage,
  pageIndex,
  setPageIndex,
  setPageSize,
}: DataTablePaginationProps) {
  const totalPages =
    rowsPerPage === "Sin Límite" ? 1 : Math.ceil(total / Number(rowsPerPage));
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);

  // Determine which page numbers to show
  const getVisiblePages = () => {
    if (totalPages <= 5) return pages;

    const visiblePages = [];
    if (pageIndex <= 3) {
      // Show first 4 pages and last page
      visiblePages.push(...pages.slice(0, 4), pages[pages.length - 1]);
    } else if (pageIndex >= totalPages - 2) {
      // Show first page and last 4 pages
      visiblePages.push(1, ...pages.slice(-4));
    } else {
      // Show first page, current page and its neighbors, and last page
      visiblePages.push(
        1,
        pageIndex - 1,
        pageIndex,
        pageIndex + 1,
        pages[pages.length - 1]
      );
    }

    return [...new Set(visiblePages)].sort((a, b) => a - b);
  };

  const visiblePages = getVisiblePages();

  const handleSetPageSize = (value: string) => {
    const newPageSize =
      value === "Sin Límite" ? "Sin Límite" : parseInt(value, 10);
    setPageSize(newPageSize);
    setPageIndex(1); // Reset to first page when changing page size
  };

  return (
    <div className="flex items-center justify-between  px-6 ">
      <div className="flex-1 text-sm text-gray-600">
        <p className="font-medium">
          {total} {total === 1 ? "item" : "items"} encontrados
        </p>
        <p className="text-xs text-gray-500">
          Página {pageIndex} de {rowsPerPage === "Sin Límite" ? 1 : totalPages}
        </p>
      </div>

      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">Filas</span>
          <Select
            value={rowsPerPage.toString()}
            onValueChange={handleSetPageSize}
          >
            <SelectTrigger className="h-9 w-auto border-gray-300 px-4 gap-2">
              <SelectValue placeholder={rowsPerPage}>
                {rowsPerPage.toString()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent side="top">
              {[5, 10, 15, 20, 30, 40, 50, "Sin Límite"].map(
                (pageSize, index) => (
                  <SelectItem key={index} value={pageSize.toString()}>
                    {pageSize}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={() => setPageIndex(pageIndex - 1)}
            disabled={pageIndex === 1}
            className="text-gray-600 hover:bg-gray-100"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>

          {total > 0 &&
            visiblePages.map((page) => (
              <Button
                key={page}
                variant={pageIndex === page ? "default" : "outline"}
                color="primary"
                className={`rounded-lg w-9 h-9 ${
                  pageIndex === page
                    ? "bg-primary-500 text-white shadow-md"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
                onClick={() => setPageIndex(page)}
                disabled={pageIndex === page}
              >
                {page}
              </Button>
            ))}

          <Button
            variant="ghost"
            onClick={() => setPageIndex(pageIndex + 1)}
            disabled={pageIndex >= totalPages}
            className="text-gray-600 hover:bg-gray-100"
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
