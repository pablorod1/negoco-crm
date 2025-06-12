import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ComercializadoraVM, User } from "@/lib/core/types";

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
    <div className="flex flex-col sm:flex-row gap-4">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar comercializadora..."
          className="pl-10"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        {!isComercial ? (
          <Badge
            variant={statusFilter === "all" ? "shadow" : "outline"}
            className="cursor-pointer"
            onClick={() => onStatusFilterChange("all")}
          >
            Todas ({comercializadoras.length})
          </Badge>
        ) : null}
        <Badge
          variant={statusFilter === "active" ? "shadow" : "outline"}
          className="cursor-pointer"
          onClick={() => onStatusFilterChange("active")}
        >
          Activas ({activeCount})
        </Badge>
        {!isComercial ? (
          <Badge
            variant={statusFilter === "inactive" ? "shadow" : "outline"}
            className="cursor-pointer"
            onClick={() => onStatusFilterChange("inactive")}
          >
            Inactivas ({inactiveCount})
          </Badge>
        ) : null}
      </div>
    </div>
  );
}
