import React from "react";
import { Search, SortAsc, SortDesc, X, LayoutGrid, Table2 } from "lucide-react";
import { Input } from "@/core/components/ui/input";
import { Button } from "@/core/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/core/components/ui/dropdown-menu";

type SortOrder = "asc" | "desc" | null;

interface ClientsFiltersProps {
  localSearchTerm: string;
  setLocalSearchTerm: (term: string) => void;
  handleClearSearch: () => void;
  viewMode: "card" | "table";
  setViewMode: (mode: "card" | "table") => void;
  sortOrder: SortOrder;
  setSortOrder: (order: SortOrder) => void;
  searchTerm: string;
  resultsCount: number;
}

export function ClientsFilters({
  localSearchTerm,
  setLocalSearchTerm,
  handleClearSearch,
  viewMode,
  setViewMode,
  sortOrder,
  setSortOrder,
  searchTerm,
  resultsCount,
}: ClientsFiltersProps) {
  return (
    <div className="space-y-4">
      {/* Main filters row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="search"
            placeholder="Buscar clientes..."
            className="pl-9 h-10 border-gray-200 focus:border-gray-300 focus:ring-0 bg-white"
            value={localSearchTerm}
            onChange={(e) => setLocalSearchTerm(e.target.value)}
          />
          {localSearchTerm && (
            <button type="button"
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex gap-2">
          {/* View toggle */}
          <div className="flex border border-gray-200 rounded-lg p-1">
            <button type="button"
              onClick={() => setViewMode("card")}
              className={`p-2 rounded-md transition-colors ${
                viewMode === "card"
                  ? "bg-gray-100 text-gray-900"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button type="button"
              onClick={() => setViewMode("table")}
              className={`p-2 rounded-md transition-colors ${
                viewMode === "table"
                  ? "bg-gray-100 text-gray-900"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Table2 className="h-4 w-4" />
            </button>
          </div>

          {/* Sort dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                {sortOrder === "asc" ? (
                  <SortAsc className="h-4 w-4" />
                ) : sortOrder === "desc" ? (
                  <SortDesc className="h-4 w-4" />
                ) : (
                  "Ordenar"
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                onClick={() => setSortOrder("asc")}
                className={sortOrder === "asc" ? "bg-gray-50" : ""}
              >
                <SortAsc className="h-4 w-4 mr-2" />
                A-Z
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setSortOrder("desc")}
                className={sortOrder === "desc" ? "bg-gray-50" : ""}
              >
                <SortDesc className="h-4 w-4 mr-2" />
                Z-A
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setSortOrder(null)}
                className={sortOrder === null ? "bg-gray-50" : ""}
              >
                Por defecto
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Results counter */}
      {(searchTerm || sortOrder) && (
        <div className="text-sm text-gray-500">
          {resultsCount} {resultsCount === 1 ? "resultado" : "resultados"}
          {searchTerm && (
            <span className="ml-2 px-2 py-1 bg-gray-100 rounded-md text-gray-700">
              &ldquo;{searchTerm}&rdquo;
              <button type="button"
                onClick={handleClearSearch}
                className="ml-1 text-gray-500 hover:text-gray-700"
              >
                <X className="h-3 w-3 inline" />
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
