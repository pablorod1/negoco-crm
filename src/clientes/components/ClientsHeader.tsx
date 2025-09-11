import React from "react";

interface ClientsHeaderProps {
  totalCount: number;
}

export function ClientsHeader({ totalCount }: ClientsHeaderProps) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          Clientes
        </h1>
        <p className="text-sm text-gray-500">
          {totalCount}{" "}
          {totalCount === 1 ? "cliente registrado" : "clientes registrados"}
        </p>
      </div>
    </div>
  );
}
