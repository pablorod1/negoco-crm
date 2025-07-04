import React from "react";
import {
  Search,
  SortAsc,
  SortDesc,
  X,
  ChevronDown,
  LayoutGrid,
  Table2,
} from "lucide-react";
import { Input } from "@/core/components/ui/input";
import { Button } from "@/core/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/core/components/ui/dropdown-menu";
import { Badge } from "@/core/components/ui/badge";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/core/components/ui/toggle-group";

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
  // Toggle sort order
  const handleSort = (order: SortOrder) => {
    setSortOrder(order);
  };

  return (
    <>
      <div className="mb-4 flex flex-col sm:flex-row items-center gap-4 px-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar por nombre, email, documento o teléfono..."
            className="w-full bg-background pl-8 shadow-none rounded-lg border border-gray-200"
            value={localSearchTerm}
            onChange={(e) => setLocalSearchTerm(e.target.value)}
          />
          {localSearchTerm && (
            <button
              onClick={handleClearSearch}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 self-end">
          <ToggleGroup
            type="single"
            value={viewMode}
            variant={"outline"}
            onValueChange={(value: "card" | "table") =>
              value && setViewMode(value)
            }
          >
            <ToggleGroupItem value="card" aria-label="Card view">
              <LayoutGrid className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="table" aria-label="Table view">
              <Table2 className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-1 text-sm border-gray-200"
              >
                Ordenar
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => handleSort("asc")}
                className={sortOrder === "asc" ? "bg-muted" : ""}
              >
                <SortAsc className="h-4 w-4 mr-2" />
                A-Z
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleSort("desc")}
                className={sortOrder === "desc" ? "bg-muted" : ""}
              >
                <SortDesc className="h-4 w-4 mr-2" />
                Z-A
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleSort(null)}
                className={sortOrder === null ? "bg-muted" : ""}
              >
                Por defecto
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Search filters display */}
      {(searchTerm || sortOrder) && (
        <div className="mb-4 px-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>Mostrando {resultsCount} resultados</span>
          <div className="flex gap-2">
            {searchTerm && (
              <Badge variant="outline" className="gap-1 pl-2">
                Búsqueda: {searchTerm}
                <button
                  onClick={handleClearSearch}
                  className="ml-1 hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {sortOrder && (
              <Badge variant="outline" className="gap-1 pl-2">
                Orden: {sortOrder === "asc" ? "A-Z" : "Z-A"}
                <button
                  onClick={() => setSortOrder(null)}
                  className="ml-1 hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
          </div>
        </div>
      )}
    </>
  );
}
