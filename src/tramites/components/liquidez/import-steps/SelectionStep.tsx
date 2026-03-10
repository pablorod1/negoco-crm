"use client";

import { useState, useMemo, useRef } from "react";
import { Search, Loader2, AlertTriangle, Info } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Button } from "@/core/components/ui/button";
import { Checkbox } from "@/core/components/ui/checkbox";
import { Input } from "@/core/components/ui/input";
import { Badge } from "@/core/components/ui/badge";
import { Progress } from "@/core/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/core/components/ui/dialog";
import { getStatusBadge } from "@/core/hooks/use-status-badge";
import { SelectComponent } from "../../createTramite/InputComponent";
import {
  PLAIN_LIQUIDEZ_STATUS,
  BAJA_LIQUIDEZ_STATUS,
} from "@/tramites/constants";
import type {
  MatchedCUPS,
  LiquidezStatus,
  Status,
  StatusTransition,
  ConflictWarning,
  UpdateProgress,
} from "@/tramites/types";

interface SelectionStepProps {
  matchedCups: MatchedCUPS[];
  selectedIds: Set<string>;
  targetStatus: LiquidezStatus;
  isUpdating: boolean;
  batchTransitions: StatusTransition[];
  conflictWarnings: ConflictWarning[];
  updateProgress: UpdateProgress | null;
  onToggleSelection: (cups: string) => void;
  onSelectAllFiltered: (cups: string[]) => void;
  onDeselectAll: () => void;
  onSetTargetStatus: (status: LiquidezStatus) => void;
  onUpdateBatch: () => Promise<void>;
  onNext: () => void;
  onBack: () => void;
}

export default function SelectionStep({
  matchedCups,
  selectedIds,
  targetStatus,
  isUpdating,
  batchTransitions,
  conflictWarnings,
  updateProgress,
  onToggleSelection,
  onSelectAllFiltered,
  onDeselectAll,
  onSetTargetStatus,
  onUpdateBatch,
  onNext,
  onBack,
}: SelectionStepProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [liquidezFilter, setLiquidezFilter] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // Virtualization ref (B.1)
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Compute unique status values for filter badges
  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>();
    matchedCups.forEach((m) => {
      const key = m.status;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return counts;
  }, [matchedCups]);

  const liquidezCounts = useMemo(() => {
    const counts = new Map<string, number>();
    matchedCups.forEach((m) => {
      const key = m.liquidezStatus ?? "Sin Asignar";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return counts;
  }, [matchedCups]);

  // Filter CUPS
  const filteredCups = useMemo(() => {
    return matchedCups.filter((m) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesSearch =
          m.cups.toLowerCase().includes(q) ||
          m.clientName.toLowerCase().includes(q) ||
          m.newCompany.toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }
      if (statusFilter && m.status !== statusFilter) return false;
      if (liquidezFilter) {
        const val = m.liquidezStatus ?? "Sin Asignar";
        if (val !== liquidezFilter) return false;
      }
      return true;
    });
  }, [matchedCups, searchQuery, statusFilter, liquidezFilter]);

  const filteredCupsIds = useMemo(
    () => filteredCups.map((m) => m.cups),
    [filteredCups],
  );

  const selectedCount = useMemo(
    () => filteredCups.filter((m) => selectedIds.has(m.cups)).length,
    [filteredCups, selectedIds],
  );

  const allFilteredSelected =
    filteredCups.length > 0 &&
    filteredCups.every((m) => selectedIds.has(m.cups));

  const totalUpdatedSoFar = batchTransitions.reduce((s, t) => s + t.count, 0);

  const allLiquidezStatuses = [
    ...PLAIN_LIQUIDEZ_STATUS,
    ...BAJA_LIQUIDEZ_STATUS,
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Batch history indicator */}
      {totalUpdatedSoFar > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-100">
          <Badge variant="success">{totalUpdatedSoFar} actualizados</Badge>
          <span className="text-xs text-green-700">
            en {batchTransitions.length} tanda
            {batchTransitions.length > 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Filters row */}
      <div className="flex flex-col gap-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar CUPS, cliente, compañía..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        {/* Status filter badges */}
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-gray-500 self-center mr-1">
            Estado:
          </span>
          {Array.from(statusCounts.entries()).map(([status, count]) => (
            <button
              key={status}
              onClick={() =>
                setStatusFilter(statusFilter === status ? null : status)
              }
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
                ${
                  statusFilter === status
                    ? "bg-primary text-white border-primary"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                }`}
            >
              {status} ({count})
            </button>
          ))}
        </div>

        {/* Liquidez status filter badges */}
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-gray-500 self-center mr-1">
            Liquidez:
          </span>
          {Array.from(liquidezCounts.entries()).map(([status, count]) => (
            <button
              key={status}
              onClick={() =>
                setLiquidezFilter(liquidezFilter === status ? null : status)
              }
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
                ${
                  liquidezFilter === status
                    ? "bg-primary text-white border-primary"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                }`}
            >
              {status} ({count})
            </button>
          ))}
        </div>
      </div>

      {/* Target status selector */}
      <SelectComponent
        name="target-status"
        label="Estado Liquidez destino"
        items={allLiquidezStatuses}
        onChange={(value) => onSetTargetStatus(value as LiquidezStatus)}
        selectedKey={(targetStatus as string) ?? ""}
        isRequired
      />

      {/* Conflict warnings (Improvement 3) */}
      {conflictWarnings.length > 0 && (
        <div className="flex flex-col gap-2">
          {conflictWarnings.map((warning, index) => (
            <div
              key={index}
              className={`flex items-start gap-2 p-3 rounded-lg border text-sm ${
                warning.severity === "warning"
                  ? "bg-amber-50 border-amber-200 text-amber-800"
                  : "bg-blue-50 border-blue-200 text-blue-800"
              }`}
            >
              {warning.severity === "warning" ? (
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              ) : (
                <Info className="h-4 w-4 mt-0.5 shrink-0" />
              )}
              <span>{warning.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Progress bar (Improvement 7) */}
      {isUpdating && updateProgress && (
        <div className="flex flex-col gap-2 p-3 rounded-lg bg-blue-50 border border-blue-100">
          <div className="flex items-center justify-between text-sm text-blue-700">
            <span>Actualizando trámites...</span>
            <span className="font-medium">{updateProgress.percentage}%</span>
          </div>
          <Progress
            value={updateProgress.percentage}
            className="h-2"
            aria-label={`Progreso de actualización: ${updateProgress.percentage}%`}
          />
          <p className="text-xs text-blue-600">
            Lote {updateProgress.current} de {updateProgress.total}
          </p>
        </div>
      )}

      {/* Select all / deselect controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              allFilteredSelected
                ? onDeselectAll()
                : onSelectAllFiltered(filteredCupsIds)
            }
          >
            {allFilteredSelected
              ? "Deseleccionar todos"
              : `Seleccionar ${filteredCups.length} filtrados`}
          </Button>
          {selectedIds.size > 0 && (
            <Button variant="ghost" size="sm" onClick={onDeselectAll}>
              Limpiar selección
            </Button>
          )}
        </div>
        <p className="text-sm text-gray-500">
          {selectedCount} de {filteredCups.length} seleccionados
        </p>
      </div>

      {/* CUPS table (B.1: virtualized) */}
      <div
        ref={tableContainerRef}
        className="max-h-64 overflow-y-auto border rounded-lg"
      >
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th scope="col" className="px-3 py-2 text-left w-10">
                <Checkbox
                  checked={allFilteredSelected}
                  onCheckedChange={() =>
                    allFilteredSelected
                      ? onDeselectAll()
                      : onSelectAllFiltered(filteredCupsIds)
                  }
                />
              </th>
              <th
                scope="col"
                className="px-3 py-2 text-left font-medium text-gray-500"
              >
                CUPS
              </th>
              <th
                scope="col"
                className="px-3 py-2 text-left font-medium text-gray-500"
              >
                Cliente
              </th>
              <th
                scope="col"
                className="px-3 py-2 text-left font-medium text-gray-500"
              >
                Compañía
              </th>
              <th
                scope="col"
                className="px-3 py-2 text-left font-medium text-gray-500"
              >
                Estado
              </th>
              <th
                scope="col"
                className="px-3 py-2 text-left font-medium text-gray-500"
              >
                Liquidez
              </th>
            </tr>
          </thead>
          <VirtualizedTableBody
            filteredCups={filteredCups}
            selectedIds={selectedIds}
            onToggleSelection={onToggleSelection}
            tableContainerRef={tableContainerRef}
          />
        </table>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={onBack}>
          Anterior
        </Button>
        <div className="flex items-center gap-3">
          {totalUpdatedSoFar > 0 && (
            <Button variant="outline" onClick={onNext}>
              Ver resumen
            </Button>
          )}
          <Button
            onClick={() => setShowConfirm(true)}
            disabled={!targetStatus || selectedCount === 0 || isUpdating}
          >
            {isUpdating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Actualizando...
              </>
            ) : (
              `Actualizar ${selectedCount} trámites`
            )}
          </Button>
        </div>
      </div>

      {/* A.2: Confirmation dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar actualización masiva</DialogTitle>
            <DialogDescription>
              Estás a punto de cambiar el estado de liquidez de{" "}
              <strong>{selectedCount}</strong> trámite
              {selectedCount !== 1 ? "s" : ""} a <strong>{targetStatus}</strong>
              .
              {conflictWarnings.length > 0 && (
                <span className="block mt-2 text-amber-600">
                  ⚠ Hay {conflictWarnings.length} advertencia
                  {conflictWarnings.length !== 1 ? "s" : ""} de conflicto.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                setShowConfirm(false);
                await onUpdateBatch();
              }}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// B.1: Extracted virtualized table body component
function VirtualizedTableBody({
  filteredCups,
  selectedIds,
  onToggleSelection,
  tableContainerRef,
}: {
  filteredCups: MatchedCUPS[];
  selectedIds: Set<string>;
  onToggleSelection: (cups: string) => void;
  tableContainerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const rowVirtualizer = useVirtualizer({
    count: filteredCups.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 40,
    overscan: 10,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  if (filteredCups.length === 0) {
    return (
      <tbody>
        <tr>
          <td
            colSpan={6}
            className="px-3 py-8 text-center text-gray-400 text-sm"
          >
            No se encontraron CUPS con los filtros aplicados
          </td>
        </tr>
      </tbody>
    );
  }

  // Use spacer rows to keep <tr> in normal table flow so columns align with <thead>
  const paddingTop = virtualItems[0]?.start ?? 0;
  const paddingBottom =
    rowVirtualizer.getTotalSize() -
    (virtualItems[virtualItems.length - 1]?.end ?? 0);

  return (
    <tbody>
      {paddingTop > 0 && (
        <tr>
          <td colSpan={6} style={{ height: paddingTop, padding: 0 }} />
        </tr>
      )}
      {virtualItems.map((virtualRow) => {
        const m = filteredCups[virtualRow.index];
        return (
          <tr
            key={m.cups}
            data-index={virtualRow.index}
            ref={rowVirtualizer.measureElement}
            className={`${virtualRow.index % 2 === 0 ? "bg-white" : "bg-gray-50/50"} ${
              selectedIds.has(m.cups) ? "bg-primary/5" : ""
            } hover:bg-gray-100/50 transition-colors cursor-pointer`}
            onClick={() => onToggleSelection(m.cups)}
          >
            <td className="px-3 py-2">
              <Checkbox
                checked={selectedIds.has(m.cups)}
                onCheckedChange={() => onToggleSelection(m.cups)}
              />
            </td>
            <td className="px-3 py-2 font-mono text-xs">{m.cups}</td>
            <td className="px-3 py-2 text-gray-700 truncate max-w-[150px]">
              {m.clientName}
            </td>
            <td className="px-3 py-2 text-gray-700 truncate max-w-[120px]">
              {m.newCompany}
            </td>
            <td className="px-3 py-2">
              {getStatusBadge(m.status as Status, "general")}
            </td>
            <td className="px-3 py-2">
              {getStatusBadge(m.liquidezStatus as LiquidezStatus, "liquidez")}
            </td>
          </tr>
        );
      })}
      {paddingBottom > 0 && (
        <tr>
          <td colSpan={6} style={{ height: paddingBottom, padding: 0 }} />
        </tr>
      )}
    </tbody>
  );
}
