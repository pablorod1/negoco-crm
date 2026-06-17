"use client";

import { useState } from "react";
import { useTransitionRouter } from "next-view-transitions";
import {
  AlertTriangle,
  CheckCircle,
  CircleX,
  Database,
  FileText,
  Loader2,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/core/components/ui/dialog";
import { Button } from "@/core/components/ui/button";
import { Badge } from "@/core/components/ui/badge";
import LoadingStateModal from "@/core/components/LoadingStateModal";
import { showCustomToast } from "@/core/components/CustomToast";
import { formatDate } from "@/core/utils/format";
import { ClientListItem } from "@/clientes/components/ClientsList";
import { User } from "@/core/types";

interface ClientContractSummary {
  id: string;
  status: string;
  creation_date: string;
  sales_name: string;
  files_count: number;
}

interface ContractSummaryResponse {
  success: boolean;
  error?: string;
  data?: {
    contracts: ClientContractSummary[];
    total: number;
    files_total: number;
  };
}

interface DeleteClientResponse {
  success: boolean;
  error?: string;
  data?: {
    client_id: string;
    contracts_deleted: number;
    firebase_files_deleted: number;
  };
}

interface DeleteClientConfirmationModalProps {
  client: ClientListItem;
  userData: User;
}

export default function DeleteClientConfirmationModal({
  client,
  userData,
}: DeleteClientConfirmationModalProps) {
  const router = useTransitionRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [summary, setSummary] =
    useState<ContractSummaryResponse["data"]>(undefined);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const clientName = `${client.name || ""} ${client.last_name || ""}`.trim();

  const fetchSummary = async () => {
    setLoadingSummary(true);
    setSummary(undefined);
    setSummaryError(null);

    try {
      const res = await fetch(`/api/v2/clients/${client.id}/contracts`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const result = (await res.json()) as ContractSummaryResponse;

      if (!result.success || !result.data) {
        setSummaryError(
          result.error || "No se pudo cargar el resumen del cliente",
        );
        showCustomToast({
          title: "Error",
          message: result.error || "No se pudo cargar el resumen del cliente",
          icon: CircleX,
          iconSize: 24,
          iconColor: "var(--danger-color)",
        });
        return;
      }

      setSummary(result.data);
    } catch (error) {
      console.error("Error fetching client contracts summary:", error);
      setSummaryError("No se pudo cargar el resumen del cliente");
      showCustomToast({
        title: "Error",
        message: "No se pudo cargar el resumen del cliente",
        icon: CircleX,
        iconSize: 24,
        iconColor: "var(--danger-color)",
      });
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (deleting) return;

    setIsOpen(open);
    if (open) {
      void fetchSummary();
    }
  };

  const handleDelete = async () => {
    setDeleting(true);

    try {
      const res = await fetch(`/api/v2/clients/${client.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          organization_id: userData.organization.id,
        }),
      });

      const result = (await res.json()) as DeleteClientResponse;

      if (!result.success) {
        showCustomToast({
          title: "Error al eliminar cliente",
          message: result.error || "No se pudo eliminar el cliente",
          icon: CircleX,
          iconSize: 24,
          iconColor: "var(--danger-color)",
        });
        return;
      }

      showCustomToast({
        title: "Cliente eliminado",
        message: `${clientName || "El cliente"} se ha eliminado correctamente`,
        icon: CheckCircle,
        iconSize: 24,
        iconColor: "var(--success-color)",
      });

      setIsOpen(false);
      router.push("/clientes");
    } catch (error) {
      console.error("Error deleting client:", error);
      showCustomToast({
        title: "Error al eliminar cliente",
        message: "Ocurrio un error al eliminar el cliente",
        icon: CircleX,
        iconSize: 24,
        iconColor: "var(--danger-color)",
      });
    } finally {
      setDeleting(false);
    }
  };

  const contracts = summary?.contracts ?? [];
  const totalContracts = summary?.total ?? 0;
  const totalFiles = summary?.files_total ?? 0;
  const previewContracts = contracts.slice(0, 5);
  const remainingContracts = Math.max(totalContracts - previewContracts.length, 0);
  const canDelete = !deleting && !loadingSummary && !summaryError && !!summary;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="destructiveOutline"
          size="sm"
        >
          <Trash2 className="h-4 w-4" />
          Eliminar cliente
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl w-full">
        {deleting ? (
          <LoadingStateModal
            title="Eliminando cliente..."
            description="Estamos eliminando contratos y archivos asociados."
          />
        ) : null}

        <DialogHeader>
          <div className="flex items-start gap-4">
            <AlertTriangle className="size-8 text-danger" />
            <div className="flex flex-col gap-1">
              <DialogTitle className="text-base font-semibold text-danger">
                Eliminar cliente de forma permanente
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-600">
                Se eliminaran el cliente, sus contratos, firmante y archivos de
                tramites asociados. Esta accion no se puede deshacer.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-danger/20 bg-danger/5 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">
                  Cliente
                </p>
                <p className="text-sm font-semibold text-gray-900">
                  {clientName || "Sin nombre"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">
                  Documento
                </p>
                <p className="text-sm font-semibold text-gray-900">
                  {[client.document_type, client.document_number]
                    .filter(Boolean)
                    .join(" ") || "-"}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-2 text-gray-600">
                <Database className="h-4 w-4" />
                <span className="text-xs font-medium uppercase">
                  Contratos
                </span>
              </div>
              <p className="mt-2 text-2xl font-semibold text-gray-900">
                {loadingSummary ? "-" : totalContracts}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-2 text-gray-600">
                <FileText className="h-4 w-4" />
                <span className="text-xs font-medium uppercase">Archivos</span>
              </div>
              <p className="mt-2 text-2xl font-semibold text-gray-900">
                {loadingSummary ? "-" : totalFiles}
              </p>
            </div>
          </div>

          {summaryError ? (
            <div className="rounded-lg border border-danger/20 bg-danger/5 p-4 text-sm text-danger">
              {summaryError}
            </div>
          ) : loadingSummary ? (
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 p-4 text-sm text-gray-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando contratos asociados...
            </div>
          ) : previewContracts.length > 0 ? (
            <div className="rounded-lg border border-gray-200">
              <div className="border-b border-gray-100 px-4 py-3">
                <p className="text-sm font-medium text-gray-900">
                  Contratos afectados
                </p>
              </div>
              <div className="divide-y divide-gray-100">
                {previewContracts.map((contract) => (
                  <div
                    key={contract.id}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {contract.id}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(contract.creation_date)} -{" "}
                        {contract.sales_name}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {contract.status}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {contract.files_count} archivos
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {remainingContracts > 0 ? (
                <div className="border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
                  Y {remainingContracts} contratos mas.
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 p-4 text-sm text-gray-600">
              Este cliente no tiene contratos asociados.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={deleting}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!canDelete}
          >
            Eliminar cliente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
