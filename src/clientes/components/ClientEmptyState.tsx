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
  const isSearchEmpty = searchTerm && totalCount > 0;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-6">
        {isSearchEmpty ? (
          <Search className="h-8 w-8 text-gray-400" />
        ) : (
          <Users className="h-8 w-8 text-gray-400" />
        )}
      </div>

      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {isSearchEmpty
          ? "No se encontraron clientes"
          : "No hay clientes registrados"}
      </h3>

      <p className="text-gray-500 mb-6 max-w-md leading-relaxed">
        {isSearchEmpty
          ? "Intenta con otros términos de búsqueda o revisa los filtros aplicados."
          : "Cuando se registren clientes en el sistema, aparecerán aquí organizados y listos para gestionar."}
      </p>

      {isSearchEmpty && (
        <Button
          variant="outline"
          onClick={handleClearSearch}
          className="border-gray-200 text-gray-700 hover:bg-gray-50"
        >
          Limpiar búsqueda
        </Button>
      )}
    </div>
  );
}
