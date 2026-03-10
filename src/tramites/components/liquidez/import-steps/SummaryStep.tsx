"use client";

import { useCallback } from "react";
import { CheckCircle, Download, ArrowRight } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { Badge } from "@/core/components/ui/badge";
import { getStatusBadge } from "@/core/hooks/use-status-badge";
import type {
  UpdateSummary,
  LiquidezStatus,
  MatchedCUPS,
} from "@/tramites/types";

interface SummaryStepProps {
  summary: UpdateSummary;
  matchedCups: MatchedCUPS[];
  onClose: () => void;
}

export default function SummaryStep({
  summary,
  matchedCups,
  onClose,
}: SummaryStepProps) {
  const handleDownloadReport = useCallback(async () => {
    const XLSX = await import("xlsx");
    const now = new Date();
    const rows = summary.transitions.flatMap((t) =>
      t.cups.map((cups) => {
        const match = matchedCups.find((m) => m.cups === cups);
        return {
          CUPS: cups,
          Cliente: match?.clientName ?? "",
          Compañía: match?.newCompany ?? "",
          "Estado Anterior": t.fromStatus ?? "Sin Asignar",
          "Estado Nuevo": t.toStatus ?? "",
          "Fecha Actualización": now.toLocaleDateString("es-ES"),
          Resultado: "Actualizado",
        };
      }),
    );

    // Add skipped CUPS
    for (const cups of summary.skippedCups) {
      const match = matchedCups.find((m) => m.cups === cups);
      rows.push({
        CUPS: cups,
        Cliente: match?.clientName ?? "",
        Compañía: match?.newCompany ?? "",
        "Estado Anterior": match?.liquidezStatus ?? "Sin Asignar",
        "Estado Nuevo": match?.liquidezStatus ?? "",
        "Fecha Actualización": now.toLocaleDateString("es-ES"),
        Resultado: "Omitido (ya en estado destino)",
      });
    }

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);

    // Set column widths
    worksheet["!cols"] = [
      { wch: 24 },
      { wch: 25 },
      { wch: 18 },
      { wch: 28 },
      { wch: 28 },
      { wch: 16 },
      { wch: 14 },
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, "Informe Liquidez");
    XLSX.writeFile(
      workbook,
      `Informe_Liquidez_${now.toISOString().slice(0, 10)}.xlsx`,
    );
  }, [summary, matchedCups]);

  return (
    <div className="flex flex-col gap-5">
      {/* Success header */}
      <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 border border-green-100">
        <CheckCircle className="h-8 w-8 text-green-600 shrink-0" />
        <div>
          <p className="text-lg font-semibold text-green-800">
            Actualización completada
          </p>
          <p className="text-sm text-green-600">
            {summary.totalUpdated} trámites actualizados correctamente
          </p>
        </div>
      </div>

      {/* Transitions table */}
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-gray-700">
          Transiciones realizadas
        </h3>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium text-gray-500">
                  Estado anterior
                </th>
                <th className="px-2 py-2.5 text-center w-8" />
                <th className="px-4 py-2.5 text-left font-medium text-gray-500">
                  Estado nuevo
                </th>
                <th className="px-4 py-2.5 text-right font-medium text-gray-500">
                  Cantidad
                </th>
              </tr>
            </thead>
            <tbody>
              {summary.transitions.map((t, idx) => (
                <tr
                  key={idx}
                  className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}
                >
                  <td className="px-4 py-2.5">
                    {getStatusBadge(t.fromStatus as LiquidezStatus, "liquidez")}
                  </td>
                  <td className="px-2 py-2.5 text-center">
                    <ArrowRight className="h-4 w-4 text-gray-400 mx-auto" />
                  </td>
                  <td className="px-4 py-2.5">
                    {getStatusBadge(t.toStatus as LiquidezStatus, "liquidez")}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-900">
                    {t.count}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t bg-gray-50">
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-2.5 text-sm font-medium text-gray-700"
                >
                  Total actualizados
                </td>
                <td className="px-4 py-2.5 text-right font-bold text-gray-900">
                  {summary.totalUpdated}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Skipped info */}
      {summary.totalSkipped > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-100">
          <Badge variant="warning">{summary.totalSkipped}</Badge>
          <span className="text-sm text-amber-700">
            CUPS omitidos (ya estaban en el estado destino)
          </span>
        </div>
      )}

      {/* Failed info */}
      {summary.totalFailed > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-100">
          <Badge variant="danger">{summary.totalFailed}</Badge>
          <span className="text-sm text-red-700">
            CUPS con error al actualizar
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={handleDownloadReport}>
          <Download className="h-4 w-4 mr-2" />
          Descargar informe
        </Button>
        <Button onClick={onClose}>Cerrar</Button>
      </div>
    </div>
  );
}
