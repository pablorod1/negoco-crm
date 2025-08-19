import React from "react";

interface ClientsHeaderProps {
  totalCount: number;
}

export function ClientsHeader({ totalCount }: ClientsHeaderProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between px-4">
      <h1 className="text-4xl font-extrabold text-primary-600 drop-shadow-sm tracking-tight">
        Gestión de Clientes
      </h1>
      <div className="text-sm text-muted-foreground">
        Total: <span className="font-medium">{totalCount} clientes</span>
      </div>
    </div>
  );
}

