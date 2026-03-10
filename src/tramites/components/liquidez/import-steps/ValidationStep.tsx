"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  ChevronDown,
  Copy,
  Loader2,
} from "lucide-react";
import { Button } from "@/core/components/ui/button";
import type { MatchedCUPS, UnmatchedCUPS } from "@/tramites/types";

interface ValidationStepProps {
  isMatching: boolean;
  matchedCups: MatchedCUPS[];
  unmatchedCups: UnmatchedCUPS[];
  duplicatesInExcel: string[];
  totalInExcel: number;
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
  onRunMatching,
  onNext,
  onBack,
}: ValidationStepProps) {
  const [showUnmatched, setShowUnmatched] = useState(false);
  const [copied, setCopied] = useState(false);

  const hasResults = matchedCups.length > 0 || unmatchedCups.length > 0;
  const notFoundCups = unmatchedCups.filter((u) => u.reason === "not_found");
  const invalidCups = unmatchedCups.filter(
    (u) => u.reason === "invalid_format",
  );

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
          <button
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
