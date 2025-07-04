import React from "react";
import { Search, Users } from "lucide-react";
import { Button } from "@/core/components/ui/button";

interface ClientEmptyStateProps {
  searchTerm: string;
  totalCount: number;
  handleClearSearch: () => void;
}

export function ClientEmptyState({
  searchTerm,
  totalCount,
  handleClearSearch,
}: ClientEmptyStateProps) {
  return (
    <div className="mt-8 flex flex-col items-center justify-center rounded-lg p-12 text-center bg-white/80 shadow-inner">
      <div className="rounded-full bg-gray-100 p-3">
        {searchTerm ? (
          <Search className="h-10 w-10 text-gray-400" />
        ) : (
          <Users className="h-10 w-10 text-gray-400" />
        )}
      </div>
      <h3 className="mt-4 text-2xl font-semibold text-gray-700">
        {totalCount > 0
          ? "No se encontraron resultados"
          : "No hay clientes registrados"}
      </h3>
      <p className="mt-2 text-base text-muted-foreground max-w-md">
        {totalCount > 0
          ? "Intente con otros términos de búsqueda o elimine los filtros."
          : "No se encontraron clientes en el sistema. Contacte al administrador si necesita registrar un nuevo cliente."}
      </p>
      {searchTerm && (
        <Button variant="outline" className="mt-4" onClick={handleClearSearch}>
          Limpiar búsqueda
        </Button>
      )}
    </div>
  );
}
