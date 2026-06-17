"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  ChevronDown,
  Copy,
  Loader2,
  ArrowRightLeft,
} from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { Progress } from "@/core/components/ui/progress";
import type {
  MatchedCUPS,
  UnmatchedCUPS,
  CommissionMismatch,
} from "@/tramites/types";

interface ValidationStepProps {
  isMatching: boolean;
  matchedCups: MatchedCUPS[];
  unmatchedCups: UnmatchedCUPS[];
  duplicatesInExcel: string[];
  totalInExcel: number;
  commissionMismatches: CommissionMismatch[];
  isCorrectingCommission: boolean;
  onCorrectCommission: (tramiteId: string) => Promise<void>;
  onCorrectAllCommissions: () => Promise<void>;
  onRunMatching: () => Promise<void>;
  onNext: () => void;
  onBack: () => void;
}

export default function ValidationStep({
  isMatching,
  matchedCups,
  unmatchedCups,
  duplicatesInExcel,
  totalInExcel,
  commissionMismatches,
  isCorrectingCommission,
  onCorrectCommission,
  onCorrectAllCommissions,
  onRunMatching,
  onNext,
  onBack,
}: ValidationStepProps) {
  const [showUnmatched, setShowUnmatched] = useState(false);
  const [showCommissionTable, setShowCommissionTable] = useState(false);
  const [copied, setCopied] = useState(false);

  const hasResults = matchedCups.length > 0 || unmatchedCups.length > 0;
  const notFoundCups = unmatchedCups.filter((u) => u.reason === "not_found");
  const invalidCups = unmatchedCups.filter(
    (u) => u.reason === "invalid_format",
  );

  // Commission comparison data
  const cupsWithCommission = useMemo(
    () => matchedCups.filter((m) => m.comisionExcel != null),
    [matchedCups],
  );
  const hasCommissionData = cupsWithCommission.length > 0;
  const correctCount = useMemo(
    () => cupsWithCommission.length - commissionMismatches.length,
    [cupsWithCommission, commissionMismatches],
  );
  const correctPercentage = hasCommissionData
    ? Math.round((correctCount / cupsWithCommission.length) * 100)
    : 0;

  // Auto-run matching on mount
  useEffect(() => {
    if (!hasResults && !isMatching) {
      onRunMatching();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCopyUnmatched = () => {
    const text = notFoundCups.map((u) => u.cups).join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (isMatching) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <div className="text-center">
          <p className="text-sm font-medium text-gray-700">
            Buscando CUPS en el sistema...
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Verificando {totalInExcel} registros
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-gray-600">
        Resultado de la validación de los CUPS importados contra el CRM.
      </p>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {/* Matched */}
        <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 border border-green-100">
          <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
          <div>
            <p className="text-xl font-bold text-green-700">
              {matchedCups.length}
            </p>
            <p className="text-xs text-green-600">Encontrados</p>
          </div>
        </div>

        {/* Not found */}
        <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-100">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          <div>
            <p className="text-xl font-bold text-amber-700">
              {notFoundCups.length}
            </p>
            <p className="text-xs text-amber-600">No encontrados</p>
          </div>
        </div>

        {/* Duplicates + Invalid */}
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-100">
          <XCircle className="h-5 w-5 text-red-500 shrink-0" />
          <div>
            <p className="text-xl font-bold text-red-600">
              {duplicatesInExcel.length + invalidCups.length}
            </p>
            <p className="text-xs text-red-500">
              {duplicatesInExcel.length > 0 && invalidCups.length > 0
                ? "Duplicados / Inválidos"
                : duplicatesInExcel.length > 0
                  ? "Duplicados"
                  : "Formato inválido"}
            </p>
          </div>
        </div>
      </div>

      {/* Unmatched detail */}
      {notFoundCups.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <button type="button"
            onClick={() => setShowUnmatched(!showUnmatched)}
            className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <span>Ver {notFoundCups.length} CUPS no encontrados</span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${showUnmatched ? "rotate-180" : ""}`}
            />
          </button>
          {showUnmatched && (
            <div className="border-t px-4 py-3">
              <div className="flex justify-end mb-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyUnmatched}
                  className="text-xs"
                >
                  <Copy className="h-3 w-3 mr-1" />
                  {copied ? "Copiado" : "Copiar todos"}
                </Button>
              </div>
              <div className="max-h-32 overflow-y-auto">
                <div className="flex flex-wrap gap-1.5">
                  {notFoundCups.map((u) => (
                    <code
                      key={u.cups}
                      className="px-2 py-0.5 text-xs bg-gray-100 rounded text-gray-600 font-mono"
                    >
                      {u.cups}
                    </code>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Invalid CUPS detail */}
      {invalidCups.length > 0 && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-100">
          <p className="text-sm font-medium text-red-700 mb-2">
            CUPS con formato inválido ({invalidCups.length})
          </p>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
            {invalidCups.map((u) => (
              <code
                key={`${u.cups}-${u.rowIndex}`}
                className="px-2 py-0.5 text-xs bg-red-100 rounded text-red-600 font-mono"
              >
                {u.cups} (fila {u.rowIndex})
              </code>
            ))}
          </div>
        </div>
      )}

      {/* Commission comparison */}
      {hasCommissionData && hasResults && (
        <div className="border rounded-lg overflow-hidden border-emerald-200">
          {/* Header with progress bar */}
          <button type="button"
            onClick={() => setShowCommissionTable(!showCommissionTable)}
            className="flex flex-col gap-2.5 w-full px-4 py-3 text-left bg-emerald-50 hover:bg-emerald-100/70 transition-colors"
          >
            <div className="flex items-center justify-between w-full">
              <span className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                <ArrowRightLeft className="h-4 w-4" />
                Validación de comisiones
              </span>
              <ChevronDown
                className={`h-4 w-4 text-emerald-600 transition-transform ${showCommissionTable ? "rotate-180" : ""}`}
              />
            </div>
            <div className="flex items-center gap-3 w-full">
              <Progress
                value={correctPercentage}
                className="h-2 bg-emerald-100"
                indicatorClassName={
                  correctPercentage === 100 ? "bg-emerald-500" : "bg-amber-500"
                }
              />
              <span className="text-xs font-medium text-emerald-600 whitespace-nowrap">
                {correctCount}/{cupsWithCommission.length} correctas
              </span>
            </div>
          </button>

          {showCommissionTable && (
            <div className="border-t border-emerald-200">
              {/* Bulk action */}
              {commissionMismatches.length > 0 && (
                <div className="flex items-center justify-between px-4 pt-3 pb-1">
                  <p className="text-xs text-amber-600">
                    {commissionMismatches.length} discrepancia
                    {commissionMismatches.length !== 1 ? "s" : ""} encontrada
                    {commissionMismatches.length !== 1 ? "s" : ""}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onCorrectAllCommissions}
                    disabled={isCorrectingCommission}
                    className="text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                  >
                    {isCorrectingCommission ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : null}
                    Corregir todos
                  </Button>
                </div>
              )}

              {/* All-correct message */}
              {commissionMismatches.length === 0 && (
                <div className="flex items-center gap-2 px-4 pt-3 pb-1">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  <p className="text-xs text-emerald-600 font-medium">
                    Todas las comisiones coinciden con la base de datos
                  </p>
                </div>
              )}

              {/* Table */}
              <div className="max-h-60 overflow-y-auto px-4 pb-3 pt-2">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="pb-1.5 font-medium">CUPS</th>
                      <th className="pb-1.5 font-medium">Cliente</th>
                      <th className="pb-1.5 font-medium">Comercial</th>
                      <th className="pb-1.5 font-medium text-right">CRM</th>
                      <th className="pb-1.5 font-medium text-right">Excel</th>
                      <th className="pb-1.5 font-medium text-center">Estado</th>
                      <th className="pb-1.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cupsWithCommission.map((m) => {
                      const isMismatch =
                        Math.abs(m.comisionExcel! - m.comision) > 0.001;
                      const diff = m.comisionExcel! - m.comision;
                      return (
                        <tr
                          key={m.cups}
                          className={`border-b last:border-0 border-gray-100 ${isMismatch ? "bg-amber-50/50" : ""}`}
                        >
                          <td className="py-1.5 font-mono text-gray-700 truncate max-w-[140px]">
                            {m.cups}
                          </td>
                          <td className="py-1.5 text-gray-600 truncate max-w-[120px]">
                            {m.clientName}
                          </td>
                          <td className="py-1.5 text-gray-600 truncate max-w-[100px]">
                            {m.comercialName}
                          </td>
                          <td className="py-1.5 text-right text-gray-500">
                            {m.comision.toFixed(2)} €
                          </td>
                          <td
                            className={`py-1.5 text-right font-medium ${isMismatch ? "text-amber-700" : "text-emerald-700"}`}
                          >
                            {m.comisionExcel!.toFixed(2)} €
                          </td>
                          <td className="py-1.5 text-center">
                            {isMismatch ? (
                              <span className="inline-flex items-center gap-0.5 text-amber-600">
                                <AlertTriangle className="h-3 w-3" />
                                <span>
                                  {diff > 0 ? "+" : ""}
                                  {diff.toFixed(2)}
                                </span>
                              </span>
                            ) : (
                              <CheckCircle className="h-3.5 w-3.5 text-emerald-500 mx-auto" />
                            )}
                          </td>
                          <td className="py-1.5 text-right">
                            {isMismatch && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onCorrectCommission(m.tramiteId)}
                                disabled={isCorrectingCommission}
                                className="h-6 px-2 text-xs text-emerald-700 hover:bg-emerald-50"
                              >
                                Corregir
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack}>
          Anterior
        </Button>
        <Button onClick={onNext} disabled={matchedCups.length === 0}>
          Siguiente
        </Button>
      </div>
    </div>
  );
}
