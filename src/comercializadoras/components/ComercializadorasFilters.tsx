import { Search } from "lucide-react";
import { Input } from "@/core/components/ui/input";
import { ComercializadoraVM } from "@/comercializadoras/types";
import { User } from "@/core/types";

interface ComercializadorasFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: "all" | "active" | "inactive";
  onStatusFilterChange: (value: "all" | "active" | "inactive") => void;
  comercializadoras: ComercializadoraVM[];
  userData: User;
}

export function ComercializadorasFilters({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  comercializadoras,
  userData,
}: ComercializadorasFiltersProps) {
  const activeCount = comercializadoras.filter((c) => c.active).length;
  const inactiveCount = comercializadoras.filter((c) => !c.active).length;
  const isComercial = userData.role === "2";

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Buscar comercializadora..."
          className="pl-10 border-gray-200 focus:border-gray-300 focus:ring-0"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="flex gap-2">
        {!isComercial && (
          <button
            onClick={() => onStatusFilterChange("all")}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              statusFilter === "all"
                ? "bg-primary-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Todas · {comercializadoras.length}
          </button>
        )}

        <button
          onClick={() => onStatusFilterChange("active")}
          className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
            statusFilter === "active"
              ? "bg-primary-900 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Activas · {activeCount}
        </button>

        {!isComercial && (
          <button
            onClick={() => onStatusFilterChange("inactive")}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              statusFilter === "inactive"
                ? "bg-primary-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Inactivas · {inactiveCount}
          </button>
        )}
      </div>
    </div>
  );
}
