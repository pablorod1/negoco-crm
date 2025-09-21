import { memo } from "react";
import { Search } from "lucide-react";
import { User } from "@/core/types";
import { ComercializadoraCard } from "./ComercializadoraCard";
import { ComercializadoraVM } from "../types";

interface ComercializadorasGridProps {
  comercializadoras: ComercializadoraVM[];
  userData: User;
  refetch: () => void;
}

export const ComercializadorasGrid = memo(function ComercializadorasGrid({
  comercializadoras,
  userData,
  refetch,
}: ComercializadorasGridProps) {
  if (comercializadoras.length === 0) {
    return (
      <div className="text-center py-16 px-4">
        <div className="max-w-sm mx-auto">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="h-6 w-6 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No se encontraron comercializadoras
          </h3>
          <p className="text-sm text-gray-500 mb-6">
            Intenta ajustar los filtros de búsqueda para encontrar lo que
            buscas.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
      {comercializadoras.map((comercializadora) => (
        <ComercializadoraCard
          key={comercializadora.id}
          comercializadora={comercializadora}
          userData={userData}
          refetch={refetch}
        />
      ))}
    </div>
  );
});
