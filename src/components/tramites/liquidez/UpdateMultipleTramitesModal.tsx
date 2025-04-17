"use client";
import { Table } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { CircleX, RefreshCcw, CheckCircle } from "lucide-react";
import {
  Dialog,
  DialogFooter,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useState, useMemo, useCallback } from "react";
import { LiquidezStatus, Status, TramiteRow, User } from "@/lib/core/types";
import { getStatusBadge } from "@/lib/hooks/use-status-badge";
import { SelectComponent } from "../createTramite/InputComponent";
import { PLAIN_LIQUIDEZ_STATUS } from "@/lib/core/const";
import { showCustomToast } from "@/components/core/CustomToast";
import LoadingStateModal from "@/components/core/LoadingStateModal";
import { useTramites } from "@/lib/contexts/TramitesContext";
import TooltipComponent from "@/components/core/TooltipComponent";

interface Props<TData> {
  table: Table<TData>;
  userData: User;
}

export function UpdateMultipleTramitesModal<TData>({ table }: Props<TData>) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTramites, setSelectedTramites] = useState<TramiteRow[]>([]);
  const [status, setStatus] = useState<LiquidezStatus>(null);
  const [loading, setLoading] = useState(false);
  const { refreshTramites } = useTramites();

  const onOpen = useCallback(() => setIsOpen(true), []);
  const onClose = useCallback(() => {
    setIsOpen(false);
    setSelectedTramites([]);
    setStatus(null);
  }, []);

  const selectedRowsLength = table.getSelectedRowModel().flatRows.length;

  // Memoize selected rows count
  const selectedRowsCount = useMemo(
    () => selectedRowsLength,
    [selectedRowsLength]
  );

  // Optimize with useCallback
  const getSelectedRows = useCallback(() => {
    const selectedRows = table
      .getSelectedRowModel()
      .flatRows.map((row) => row.original as TramiteRow);
    setSelectedTramites(selectedRows);
    return selectedRows;
  }, [table]);

  const hasSelectedRows = useMemo(
    () => selectedRowsCount > 0,
    [selectedRowsCount]
  );

  const buttonClasses = useMemo(
    () =>
      hasSelectedRows
        ? "h-10 w-10 bg-blue-50 border-blue-200"
        : "h-10 w-10 bg-gray-50 border-gray-200",
    [hasSelectedRows]
  );

  const handleOpenModal = useCallback(() => {
    getSelectedRows();
    onOpen();
  }, [getSelectedRows, onOpen]);

  const handleUpdate = useCallback(async () => {
    if (!status) {
      showCustomToast({
        title: "Error",
        message: "Por favor selecciona un estado de liquidez",
        iconColor: "var(--danger-color)",
        iconSize: 24,
        icon: CircleX,
      });
      return;
    }

    try {
      setLoading(true);

      const ids = selectedTramites.map((tramite) => tramite.id);

      const res = await fetch("/api/tramites/update/multiple-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids, status }),
      });

      const { success, error } = await res.json();

      if (!success) {
        showCustomToast({
          title: "Error",
          message: error,
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: CircleX,
        });
        return;
      }

      showCustomToast({
        title:
          selectedTramites.length > 1
            ? "Trámites actualizados"
            : "Trámite actualizado",
        message:
          selectedTramites.length > 1
            ? "Los trámites han sido actualizados correctamente"
            : "El trámite ha sido actualizado correctamente",
        iconColor: "var(--success-color)",
        iconSize: 24,
        icon: CheckCircle,
      });
      table.resetRowSelection();
      setSelectedTramites([]);
      setStatus(null);

      try {
        await refreshTramites();
        onClose();
      } catch (error) {
        console.error("Error al refrescar los trámites:", error);
        showCustomToast({
          title: "Error",
          message: "Inténtalo de nuevo más tarde",
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: CircleX,
        });
        onClose();
      }
    } catch (error) {
      console.error("Error al actualizar trámites:", error);
      showCustomToast({
        title: "Error",
        message: "Inténtalo de nuevo más tarde",
        iconColor: "var(--danger-color)",
        iconSize: 24,
        icon: CircleX,
      });
    } finally {
      setLoading(false);
    }
  }, [selectedTramites, onClose, status, table, refreshTramites]);

  const tooltipContent = useMemo(
    () =>
      hasSelectedRows
        ? `Actualizar ${selectedRowsCount} trámites`
        : "No hay trámites seleccionados",
    [hasSelectedRows, selectedRowsCount]
  );

  const modalTitle = useMemo(
    () =>
      selectedTramites.length > 1
        ? `¿Estás seguro de que deseas actualizar ${selectedTramites.length} trámites?`
        : "¿Estás seguro de que deseas actualizar el trámite?",
    [selectedTramites.length]
  );

  const modalDescription = useMemo(
    () =>
      selectedTramites.length > 1
        ? "Todos los trámites se actualizarán al estado seleccionado."
        : "El trámite se actualizará al estado seleccionado.",
    [selectedTramites.length]
  );

  const updateButtonText = useMemo(
    () =>
      selectedTramites.length > 1
        ? "Actualizar Trámites"
        : "Actualizar Trámite",
    [selectedTramites.length]
  );

  const handleStatusChange = (value: string) => {
    setStatus(value as LiquidezStatus);
  };

  return (
    <>
      <Dialog open={isOpen}>
        <DialogTrigger asChild>
          <TooltipComponent content={tooltipContent}>
            <Button
              onClick={handleOpenModal}
              variant="outline"
              size="icon"
              className={buttonClasses}
              disabled={!hasSelectedRows}
            >
              <div className="relative">
                <RefreshCcw className="h-4 w-4" />
                {hasSelectedRows && (
                  <div className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-blue-500" />
                )}
              </div>
            </Button>
          </TooltipComponent>
        </DialogTrigger>
        <DialogContent className="max-w-2xl w-full">
          <DialogHeader>
            <div className="flex items-start gap-4">
              <RefreshCcw className="size-12 text-primary" />
              <div className="flex flex-col">
                <DialogTitle className="text-lg font-semibold text-primary">
                  {modalTitle}
                </DialogTitle>
                <DialogDescription className="text-gray-600 text-sm">
                  {modalDescription}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="flex flex-col gap-4 mt-2">
            {loading && (
              <LoadingStateModal
                title="Actualizando trámites..."
                description="Espere unos segundos mientras actualizamos el estado de los trámites seleccionados."
              />
            )}
            <SelectComponent
              name="status"
              label="Estado Liquidez"
              items={PLAIN_LIQUIDEZ_STATUS}
              onChange={handleStatusChange}
              selectedKey={status as string}
              isRequired
            />
            {selectedTramites.length > 1 ? (
              <div className="max-h-60 overflow-y-auto border rounded-md p-2">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">
                        ID
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">
                        Estado
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">
                        Estado Liquidez
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTramites.map((tramite, index) => (
                      <tr
                        key={tramite.id}
                        className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                      >
                        <td className="px-3 py-2">{tramite.id}</td>
                        <td className="px-3 py-2">
                          {getStatusBadge(tramite.status as Status)}
                        </td>
                        <td className="px-3 py-2">
                          {getStatusBadge(
                            tramite.liquidez_status as LiquidezStatus
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              selectedTramites.length === 1 && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">ID:</h3>
                    <p className="text-gray-600">{selectedTramites[0]?.id}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">Estado:</h3>
                    <p className="text-gray-600">
                      {getStatusBadge(selectedTramites[0]?.status as Status)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">Estado Liquidez:</h3>
                    <p className="text-gray-600">
                      {getStatusBadge(
                        selectedTramites[0]?.liquidez_status as LiquidezStatus
                      )}
                    </p>
                  </div>
                </div>
              )
            )}
          </div>
          <DialogFooter>
            <Button variant="destructive" onClick={onClose}>
              Cancelar
            </Button>
            <Button color="primary" onClick={handleUpdate}>
              {updateButtonText}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
