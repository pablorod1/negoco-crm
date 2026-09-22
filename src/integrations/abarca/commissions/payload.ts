import { createHash } from "node:crypto";
import type { AbarcaCatalogEntry, AbarcaCommissionRule } from "./contract";
import { toAbarcaCommissionType } from "./contract";
import type { CommissionSegment, CommissionType } from "@/core/types";

const normalize = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .trim()
  .replace(/\s+/g, " ")
  .toUpperCase();

export interface PayloadBuildResult {
  rules: AbarcaCommissionRule[];
  unresolved: string[];
  hash: string;
  retiringKeys: Set<string>;
}

export function buildAbarcaPayload(
  effective: Record<string, unknown>[],
  mappings: Record<string, unknown>[],
  managed: Record<string, unknown>[],
  catalog: AbarcaCatalogEntry[],
): PayloadBuildResult {
  const available = new Map(
    catalog.map((entry) => [`${entry.segmento}:${normalize(entry.comercializadora)}`, entry]),
  );
  const desired = new Map<string, AbarcaCommissionRule>();
  const unresolved: string[] = [];
  const retiringKeys = new Set<string>();

  for (const rule of effective) {
    const segment = String(rule.segment) as CommissionSegment;
    const matches = mappings.filter((mapping) =>
      String(mapping.comercializadora_id) === String(rule.comercializadora_id) &&
      String(mapping.segment) === segment,
    );
    if (matches.length === 0) {
      unresolved.push(`${rule.comercializadora_id}/${segment}: sin mapeo`);
      continue;
    }
    for (const mapping of matches) {
      const name = String(mapping.abarca_name);
      const catalogEntry = available.get(`${segment}:${normalize(name)}`);
      if (!catalogEntry || catalogEntry.bloqueada) {
        unresolved.push(`${name}/${segment}: no disponible o bloqueada`);
        continue;
      }
      const key = `${segment}:${normalize(catalogEntry.comercializadora)}`;
      desired.set(key, {
        comercializadora: catalogEntry.comercializadora,
        segmento: segment,
        tipo: toAbarcaCommissionType(String(rule.commission_type) as CommissionType),
        valor: Number(rule.commission_value),
      });
    }
  }

  for (const previous of managed) {
    const segment = String(previous.segment) as CommissionSegment;
    const name = String(previous.abarca_name);
    const key = `${segment}:${normalize(name)}`;
    if (!desired.has(key)) {
      const catalogEntry = available.get(key);
      if (!catalogEntry || catalogEntry.bloqueada) {
        unresolved.push(`${name}/${segment}: retirada no disponible o bloqueada`);
        continue;
      }
      retiringKeys.add(key);
      desired.set(key, {
        comercializadora: catalogEntry.comercializadora,
        segmento: segment,
        tipo: toAbarcaCommissionType(String(previous.commission_type) as CommissionType),
        valor: 0,
      });
    }
  }

  const rules = [...desired.values()].sort((a, b) =>
    `${a.segmento}:${a.comercializadora}`.localeCompare(`${b.segmento}:${b.comercializadora}`),
  );
  const hash = createHash("sha256").update(JSON.stringify({
    reglas: rules,
    comision_personalizada: null,
  })).digest("hex");
  return { rules, unresolved, hash, retiringKeys };
}

export function remoteMatches(
  expected: AbarcaCommissionRule[],
  actual: AbarcaCommissionRule[],
) {
  const values = new Map(actual.map((rule) => [
    `${rule.segmento}:${normalize(rule.comercializadora)}`,
    rule,
  ]));
  return expected.every((rule) => {
    const found = values.get(`${rule.segmento}:${normalize(rule.comercializadora)}`);
    return found?.tipo === rule.tipo && found.valor === rule.valor;
  });
}

function formatRuleValue(rule: AbarcaCommissionRule) {
  return `${rule.valor}${rule.tipo === "porcentaje" ? "%" : " €"}`;
}

/**
 * Explica las diferencias de valor/tipo entre el CRM y el Comparador. Se usa
 * para que el panel pueda indicar qué regla concreta falta o no coincide.
 */
export function describeRemoteDifferences(
  expected: AbarcaCommissionRule[],
  actual: AbarcaCommissionRule[],
) {
  const values = new Map(actual.map((rule) => [
    `${rule.segmento}:${normalize(rule.comercializadora)}`,
    rule,
  ]));

  return expected.flatMap((rule) => {
    const found = values.get(`${rule.segmento}:${normalize(rule.comercializadora)}`);
    const label = `${rule.comercializadora} / ${rule.segmento}`;
    if (!found) {
      return [`${label}: CRM ${formatRuleValue(rule)} · Comparador sin configurar`];
    }
    if (found.tipo !== rule.tipo || found.valor !== rule.valor) {
      return [
        `${label}: CRM ${formatRuleValue(rule)} · Comparador ${formatRuleValue(found)}`,
      ];
    }
    return [];
  });
}
