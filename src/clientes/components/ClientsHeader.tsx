import React, { useState } from "react";
import { Button } from "@/core/components/ui/button";
import { UserPlus } from "lucide-react";
import CreateClientDialog from "./CreateClientDialog";

interface ClientsHeaderProps {
  totalCount: number;
}

export function ClientsHeader({ totalCount }: ClientsHeaderProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  return (
    <>
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
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            className="flex items-center gap-2"
          >
            <UserPlus className="h-4 w-4" />
            Nuevo cliente
          </Button>
        </div>
      </div>

      <CreateClientDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
      />
    </>
  );
}
