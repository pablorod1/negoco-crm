"use client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/core/components/ui/dialog";
import { Button } from "@/core/components/ui/button";
import { AlertTriangle, FileText, Users } from "lucide-react";
import { useState, useEffect, useCallback } from "react";

interface ClientContract {
  id: string;
  status: string;
  creation_date: string;
  sales_name: string;
}

interface ClientUpdateConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmUpdate: () => void;
  onCreateNew: () => void;
  clientId: string;
  isLoading?: boolean;
}

export default function ClientUpdateConfirmationDialog({
  isOpen,
  onClose,
  onConfirmUpdate,
  onCreateNew,
  clientId,
  isLoading = false,
}: ClientUpdateConfirmationDialogProps) {
  const [contracts, setContracts] = useState<ClientContract[]>([]);
  const [loadingContracts, setLoadingContracts] = useState(false);

  const fetchClientContracts = useCallback(async () => {
    setLoadingContracts(true);
    try {
      const response = await fetch(`/api/v2/clients/${clientId}/contracts`);
      const data = await response.json();

      if (data.success) {
        setContracts(data.data.contracts);
      } else {
        console.error("Error fetching contracts:", data.error);
        setContracts([]);
      }
    } catch (error) {
      console.error("Error fetching contracts:", error);
      setContracts([]);
    } finally {
      setLoadingContracts(false);
    }
  }, [clientId]);

  useEffect(() => {
    if (isOpen && clientId) {
      fetchClientContracts();
    }
  }, [isOpen, clientId, fetchClientContracts]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary-800">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Actualizar Información del Cliente
          </DialogTitle>
          <DialogDescription>
            Este cliente tiene trámites asociados. Elige cómo quieres proceder
            con la actualización.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 border rounded-lg bg-orange-50 border-orange-200">
            <div className="flex items-start gap-2">
              <Users className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-orange-900">¡Importante!</p>
                <p className="text-sm text-orange-700 mt-1">
                  Si actualizas la información de este cliente,
                  {contracts.length > 0
                    ? ` se modificará en ${contracts.length} trámite${contracts.length > 1 ? "s" : ""} asociado${contracts.length > 1 ? "s" : ""}.`
                    : " se aplicará a todos los trámites asociados."}
                </p>
              </div>
            </div>
          </div>

          {loadingContracts ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : contracts.length > 0 ? (
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-primary-700 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Trámites que se verán afectados ({contracts.length}):
              </h4>
              <div className="max-h-32 overflow-y-auto border rounded-lg">
                {contracts.slice(0, 5).map((contract) => (
                  <div
                    key={contract.id}
                    className="flex justify-between items-center p-3 border-b last:border-b-0"
                  >
                    <div>
                      <p className="font-medium text-sm">{contract.id}</p>
                      <p className="text-xs text-gray-600">
                        {contract.sales_name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-primary-600">
                        {contract.status}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(contract.creation_date)}
                      </p>
                    </div>
                  </div>
                ))}
                {contracts.length > 5 && (
                  <div className="p-3 text-center text-sm text-gray-500 bg-gray-50">
                    ... y {contracts.length - 5} más
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500">
              No se encontraron trámites asociados
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 pt-4">
            <div className="p-4 border rounded-lg bg-blue-50 border-blue-200">
              <h5 className="font-medium text-blue-900 mb-2">
                Opción 1: Actualizar cliente existente
              </h5>
              <p className="text-sm text-blue-700">
                Se actualizará la información en todos los trámites asociados a
                este cliente. Los datos históricos se modificarán.
              </p>
            </div>

            <div className="p-4 border rounded-lg bg-green-50 border-green-200">
              <h5 className="font-medium text-green-900 mb-2">
                Opción 2: Crear nuevo cliente
              </h5>
              <p className="text-sm text-green-700">
                Se creará un nuevo cliente con la información actualizada. Solo
                este trámite usará los nuevos datos, el resto mantendrá la
                información original.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            variant="outline"
            onClick={onConfirmUpdate}
            disabled={isLoading || loadingContracts}
            className="border-blue-200 text-blue-700 hover:bg-blue-50"
          >
            {isLoading ? "Actualizando..." : "Actualizar Existente"}
          </Button>
          <Button
            onClick={onCreateNew}
            disabled={isLoading || loadingContracts}
            className="bg-green-600 hover:bg-green-700"
          >
            {isLoading ? "Creando..." : "Crear Nuevo Cliente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
