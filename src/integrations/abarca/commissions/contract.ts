import { z } from "zod";
import type { CommissionSegment, CommissionType } from "@/core/types";

const TIMEOUT_MS = 12_000;

export interface AbarcaCommissionRule {
  comercializadora: string;
  segmento: CommissionSegment;
  tipo: "porcentaje" | "fija";
  valor: number;
}

export interface AbarcaCatalogEntry {
  comercializadora: string;
  segmento: CommissionSegment;
  bloqueada: boolean;
}

export interface AbarcaCommissionSnapshot {
  ok: boolean;
  catalog: AbarcaCatalogEntry[];
  rules: AbarcaCommissionRule[];
  personalized: number | null | undefined;
  warnings: string[];
  raw: unknown;
}

const objectSchema = z.record(z.string(), z.unknown());

function record(value: unknown): Record<string, unknown> | null {
  const parsed = objectSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function arrayAt(root: Record<string, unknown>, names: string[]) {
  for (const name of names) if (Array.isArray(root[name])) return root[name];
  return [];
}

function textAt(root: Record<string, unknown>, names: string[]) {
  for (const name of names) {
    const value = root[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function segmentAt(root: Record<string, unknown>): CommissionSegment | null {
  const value = textAt(root, ["segmento", "segment", "tipo_tarifa", "tarifa"])
    ?.toLowerCase()
    .replace(/[ .-]/g, "_");
  if (value === "gas") return "gas";
  if (["luz_20td", "luz_2_0td", "2_0td", "20td"].includes(value ?? "")) return "luz_20td";
  if (["luz_pymes", "3_0td", "6_1td", "pymes"].includes(value ?? "")) return "luz_pymes";
  return null;
}

function typeAt(root: Record<string, unknown>): "porcentaje" | "fija" | null {
  const value = textAt(root, ["tipo", "tipo_comision", "commission_type"]);
  if (value === "porcentaje" || value === "percent") return "porcentaje";
  if (value === "fija" || value === "fixed") return "fija";
  return null;
}

function parseRule(value: unknown): AbarcaCommissionRule | null {
  const row = record(value);
  if (!row) return null;
  const comercializadora = textAt(row, ["comercializadora", "nombre", "company"]);
  const segmento = segmentAt(row);
  const tipo = typeAt(row);
  const rawValue = row.valor ?? row.value ?? row.comision;
  const valor = typeof rawValue === "number" ? rawValue : Number(rawValue);
  if (!comercializadora || !segmento || !tipo || !Number.isFinite(valor) || valor < 0) return null;
  return { comercializadora, segmento, tipo, valor };
}

function parseCatalogRows(rows: unknown[], inheritedSegment?: CommissionSegment): AbarcaCatalogEntry[] {
  const result: AbarcaCatalogEntry[] = [];
  for (const value of rows) {
    const row = record(value);
    if (!row) {
      if (typeof value === "string" && inheritedSegment) {
        result.push({ comercializadora: value, segmento: inheritedSegment, bloqueada: false });
      }
      continue;
    }
    const comercializadora = textAt(row, ["comercializadora", "nombre", "name"]);
    const segmento = segmentAt(row) ?? inheritedSegment ?? null;
    if (comercializadora && segmento) {
      result.push({
        comercializadora,
        segmento,
        bloqueada: row.bloqueada === true || row.blocked === true,
      });
    }
    const nested = arrayAt(row, ["comercializadoras", "companies", "items"]);
    if (nested.length && segmento) result.push(...parseCatalogRows(nested, segmento));
  }
  return result;
}

function parseCatalog(root: Record<string, unknown>): AbarcaCatalogEntry[] {
  const source = root.catalogo ?? root.comercializadoras ?? root.catalog;
  if (Array.isArray(source)) return parseCatalogRows(source);
  const grouped = record(source);
  if (!grouped) return [];
  return (Object.entries(grouped) as [string, unknown][]).flatMap(([name, rows]) => {
    const segmento = segmentAt({ segmento: name });
    return segmento && Array.isArray(rows) ? parseCatalogRows(rows, segmento) : [];
  });
}

export function parseAbarcaCommissionSnapshot(value: unknown): AbarcaCommissionSnapshot {
  const root = record(value);
  if (!root || root.ok !== true) throw new Error("Respuesta inválida del Comparador");
  const user = record(root.usuario) ?? root;
  const rules = [
    ...arrayAt(root, ["reglas", "rules"]),
    ...arrayAt(user, ["reglas", "rules"]),
  ].map(parseRule).filter((rule): rule is AbarcaCommissionRule => rule !== null);
  const warnings = arrayAt(root, ["warnings", "avisos"]).map(String);
  const personalized = user.comision_personalizada === null
    ? null
    : typeof user.comision_personalizada === "number"
      ? user.comision_personalizada
      : undefined;
  return { ok: true, catalog: parseCatalog(root), rules, personalized, warnings, raw: value };
}

function endpoint(abarcaUserId: number) {
  const configured = process.env.ABARCA_COMISION_API_URL?.trim();
  if (!configured) throw new Error("La URL del Comparador no está configurada");
  const base = configured.replace(/\/$/, "");
  return `${base}/${abarcaUserId}`;
}

async function request(abarcaUserId: number, init?: RequestInit) {
  const apiKey = process.env.ABARCA_COMISION_API_KEY;
  if (!apiKey) throw new Error("La clave del Comparador no está configurada");
  const response = await fetch(endpoint(abarcaUserId), {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
      ...init?.headers,
    },
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`El Comparador respondió HTTP ${response.status}`);
  return parseAbarcaCommissionSnapshot(body);
}

export const getAbarcaCommissions = (abarcaUserId: number) => request(abarcaUserId);

export const putAbarcaCommissions = (
  abarcaUserId: number,
  rules: AbarcaCommissionRule[],
) => request(abarcaUserId, {
  method: "PUT",
  body: JSON.stringify({ reglas: rules, comision_personalizada: null }),
});

export const toAbarcaCommissionType = (
  type: CommissionType,
): AbarcaCommissionRule["tipo"] => type === "fixed" ? "fija" : "porcentaje";
