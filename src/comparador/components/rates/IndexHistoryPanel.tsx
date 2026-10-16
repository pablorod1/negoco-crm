"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, LineChart, Trash2 } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { Textarea } from "@/core/components/ui/textarea";
import { cn } from "@/core/utils";
import { Panel, PanelHeader } from "@/comparador/components/study/ui";
import {
  formatMonth,
  HISTORY_UNITS,
  monthsBetween,
  parseHistoryText,
  type HistoryUnit,
} from "@/comparador/rates/index-history-text";
import { ratesApi, type IndexHistoryRow, type SupplierRatesResponse } from "./api";

/** 0,1234: cuatro decimales, hasta seis si los tiene. */
const price = (value: number) => value.toLocaleString("es-ES", { minimumFractionDigits: 4, maximumFractionDigits: 6 });

/** Las tarifas indexadas de la comercializadora, a las que se aplica el histórico. */
export function indexedProducts(data: SupplierRatesResponse) {
  return data.rates.filter((product) => product.rows.some((row) => row.pricing === "indexed"));
}

/** Meses de histórico que valen para una tarifa: los suyos y los de toda la comercializadora. */
export function historyMonthsFor(history: readonly IndexHistoryRow[], rateId: string): string[] {
  return [...new Set(history.filter((row) => row.rateId === null || row.rateId === rateId).map(({ month }) => month))].sort();
}

/** «de may 2025 a sep 2026 · 17 meses · faltan jul 2025»; null sin meses. */
export function describeCoverage(months: readonly string[]): string | null {
  if (months.length === 0) return null;
  const all = monthsBetween(months[0], months.at(-1)!);
  const missing = all.filter((month) => !months.includes(month));
  return [
    `de ${formatMonth(months[0])} a ${formatMonth(months.at(-1)!)}`,
    `${months.length} ${months.length === 1 ? "mes" : "meses"}`,
    ...(missing.length ? [`faltan ${missing.slice(0, 4).map(formatMonth).join(", ")}${missing.length > 4 ? "…" : ""}`] : []),
  ].join(" · ");
}

/**
 * Histórico del indexado de una comercializadora: lo que cobraron sus tarifas
 * indexadas cada mes por la energía. Con él se ofertan: cada lectura del SIPS
 * del cliente se cobra al precio de su mes. Se carga pegando las filas de la
 * hoja o del documento que manda la comercializadora.
 */
export function IndexHistoryPanel({ data, onSaved }: { data: SupplierRatesResponse; onSaved: () => void }) {
  const products = indexedProducts(data);
  const scopes = [
    { id: null as string | null, label: "Toda la comercializadora" },
    ...products.map((product) => ({ id: product.rateId as string | null, label: product.name })),
  ];
  const [scope, setScope] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  // Las comercializadoras lo dan en €/MWh (Eleia, octubre de 2026).
  const [unit, setUnit] = useState<HistoryUnit>("eur_mwh");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows = data.indexHistory
    .filter((row) => row.rateId === scope)
    .sort((left, right) => right.month.localeCompare(left.month));
  const coverage = describeCoverage(rows.map(({ month }) => month).sort());
  const parsed = useMemo(() => parseHistoryText(text, unit), [text, unit]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await ratesApi.saveIndexHistory(data.supplier.id, scope, parsed.months);
      setEditing(false);
      setText("");
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se ha podido guardar");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (month: string) => {
    setError(null);
    try {
      await ratesApi.deleteIndexHistoryMonth(data.supplier.id, scope, month);
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se ha podido quitar");
    }
  };

  return (
    <Panel>
      <PanelHeader
        title="Histórico del indexado"
        description="El precio base de la energía de cada mes, con ATR, peajes y cargos. El fee de cada tarifa se suma encima y los SSAA van aparte. Llega con un mes de retraso: el mes que aún falta se cobra como el mismo mes del año anterior."
        action={
          data.canManage && !editing ? (
            <Button size="sm" variant="outline" className="rounded-lg" onClick={() => setEditing(true)}>
              Añadir meses
            </Button>
          ) : undefined
        }
      />
      <div className="space-y-4 px-5 pb-5 pt-3">
        {scopes.length > 1 && (
          <div aria-label="Histórico de" className="flex flex-wrap gap-1.5">
            {scopes.map((option) => {
              const selected = option.id === scope;
              const count = data.indexHistory.filter((row) => row.rateId === option.id).length;
              return (
                <button
                  key={option.id ?? "all"}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setScope(option.id)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-xs ring-1 transition-colors",
                    selected ? "bg-primary-50 font-medium text-primary-700 ring-primary-200" : "text-gray-600 ring-gray-200 hover:bg-gray-50",
                  )}
                >
                  {option.label}
                  <span className="ml-1 tabular-nums text-gray-400">{count}</span>
                </button>
              );
            })}
          </div>
        )}

        {products.length === 0 && (
          <p className="text-xs text-gray-500">
            {data.supplier.name} no tiene tarifas indexadas vigentes. El histórico se puede cargar ya: se usará cuando llegue su anexo.
          </p>
        )}

        {editing && (
          <div className="space-y-3 rounded-xl bg-gray-50 p-3 ring-1 ring-gray-950/[0.04]">
            <p className="text-xs text-gray-600">
              Pega las filas de la hoja o del documento: el mes y el precio de punta, llano y valle (o uno solo si es igual a todas horas).
              Un mes que ya está se sustituye.
            </p>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-gray-500">Unidad</span>
              {(Object.keys(HISTORY_UNITS) as HistoryUnit[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setUnit(key)}
                  className={cn(
                    "rounded-md px-2 py-0.5 ring-1",
                    unit === key ? "bg-white font-medium text-gray-900 ring-gray-300" : "text-gray-500 ring-transparent hover:bg-white",
                  )}
                >
                  {HISTORY_UNITS[key].label}
                </button>
              ))}
            </div>
            <Textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={6}
              className="rounded-xl bg-white font-mono text-xs"
              placeholder={"Sep-25\t176,01\t119,39\t106,99\nOct-25\t215,25\t160,36\t127,57"}
            />
            {text.trim() && (
              <p className="text-xs text-gray-600">
                {parsed.months.length > 0
                  ? `${parsed.months.length} ${parsed.months.length === 1 ? "mes" : "meses"}: ${describeCoverage(parsed.months.map(({ month }) => month))}`
                  : "Ningún mes leído todavía."}
              </p>
            )}
            {parsed.problems.length > 0 && (
              <ul className="space-y-0.5 text-xs text-warning-700">
                {parsed.problems.slice(0, 5).map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            )}
            {error && <p className="text-xs text-danger">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" disabled={saving} onClick={() => setEditing(false)}>
                Cancelar
              </Button>
              <Button size="sm" disabled={saving || parsed.months.length === 0 || parsed.problems.length > 0} onClick={save}>
                Guardar {parsed.months.length > 0 ? `${parsed.months.length} ${parsed.months.length === 1 ? "mes" : "meses"}` : ""}
              </Button>
            </div>
          </div>
        )}

        {rows.length === 0 ? (
          <p className="flex items-start gap-2 text-sm text-gray-500">
            <LineChart className="mt-0.5 size-4 shrink-0 text-gray-400" />
            {scope === null
              ? `Sin histórico de ${data.supplier.name}. Reenvíalo al buzón cuando llegue o pégalo aquí.`
              : "Sin histórico propio: usa el de toda la comercializadora."}
          </p>
        ) : (
          <>
            {coverage && <p className="text-xs text-gray-500">Cubre {coverage}.</p>}
            <div className="max-h-80 overflow-y-auto rounded-xl ring-1 ring-gray-950/[0.06]">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 bg-gray-50 text-[10px] uppercase tracking-[0.08em] text-gray-500">
                  <tr>
                    <th className="px-2 py-2 text-left font-medium">Mes</th>
                    <th className="px-2 py-2 text-right font-medium">Punta</th>
                    <th className="px-2 py-2 text-right font-medium">Llano</th>
                    <th className="px-2 py-2 text-right font-medium">Valle</th>
                    {data.canManage && <th className="w-6" aria-label="Quitar" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className="whitespace-nowrap px-2 py-1.5 text-gray-700">{formatMonth(row.month)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-gray-900">{price(row.energy.P1)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-gray-900">{price(row.energy.P2)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-gray-900">{price(row.energy.P3)}</td>
                      {data.canManage && (
                        <td className="pr-1 text-right">
                          <button
                            type="button"
                            aria-label={`Quitar ${formatMonth(row.month)}`}
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                            onClick={() => remove(row.month)}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {error && !editing && (
              <p className="flex items-center gap-1.5 text-xs text-danger">
                <AlertTriangle className="size-3.5" /> {error}
              </p>
            )}
          </>
        )}
      </div>
    </Panel>
  );
}
