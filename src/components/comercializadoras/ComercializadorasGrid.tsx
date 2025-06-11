import { memo } from "react";
import { ComercializadoraVM } from "@/lib/core/types";
import { ComercializadoraCard } from "./ComercializadoraCard";

interface ComercializadorasGridProps {
  comercializadoras: ComercializadoraVM[];
}

export const ComercializadorasGrid = memo(function ComercializadorasGrid({
  comercializadoras,
}: ComercializadorasGridProps) {
  if (comercializadoras.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          No se encontraron comercializadoras
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
      {comercializadoras.map((comercializadora) => (
        <ComercializadoraCard
          key={comercializadora.id}
          comercializadora={comercializadora}
        />
      ))}
    </div>
  );
});
