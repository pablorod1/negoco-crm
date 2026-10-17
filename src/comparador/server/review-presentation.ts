import { commissionAmount, commissionScope } from "@/comparador/components/rates/commission-text";
import { describeConditions, describePower, formatPrice } from "@/comparador/components/rates/api";
import type { DiffEntry } from "@/comparador/rates/diff";
import type { IngestReview } from "@/comparador/rates/service";

/**
 * La revisión con los textos que enseña el CRM (condiciones, energía,
 * potencia, a qué se aplica cada comisión), para que el backoffice de Negoco
 * la pinte igual sin copiar cómo se escriben.
 */

const energyText = (value: { P1: number; P2: number; P3: number } | null) =>
  value
    ? value.P1 === value.P2 && value.P2 === value.P3
      ? formatPrice(value.P1)
      : `${formatPrice(value.P1)} / ${formatPrice(value.P2)} / ${formatPrice(value.P3)}`
    : "—";

function presentEntry(entry: DiffEntry) {
  const row = entry.proposed ?? entry.active!;
  return {
    key: entry.key,
    rowKey: entry.rowKey,
    kind: entry.kind,
    productName: entry.productName,
    accessTariff: entry.conditions.accessTariff,
    conditionsText: describeConditions({ ...entry.conditions, ...row }),
    // La energía de una indexada sale de su histórico mensual, no del anexo.
    energyText:
      entry.proposed?.pricing === "indexed" ? "Indexada · histórico" : energyText((entry.proposed ?? entry.active)?.energy ?? null),
    previousEnergyText: entry.kind === "changed" && entry.active ? energyText(entry.active.energy) : null,
    powerText: describePower({ ...row, accessTariff: entry.conditions.accessTariff }),
    /** Precio base: admite el fee de la agencia. */
    admitsFee: (entry.proposed ?? entry.active)?.feeEnergyMinPerMwh != null,
    sourceExcerpt: entry.proposed?.sourceExcerpt ?? null,
  };
}

export function presentReview(review: IngestReview | null) {
  if (!review) return null;
  return {
    supplier: { id: review.supplier.id, name: review.supplier.name },
    activeVersion: review.activeVersion ? { validFrom: review.activeVersion.validFrom } : null,
    validFrom: review.validFrom,
    partialUpdate: review.partialUpdate,
    issues: review.issues,
    newProducts: review.newProducts,
    entries: review.entries.map(presentEntry),
    commissions: review.commissions.map((rule) => ({
      energy: rule.energy ?? "electricity",
      documentLevel: rule.documentLevel,
      groupText: commissionScope(rule, { withConsumption: false }),
      scopeText: commissionScope(rule),
      amountText: commissionAmount(rule),
      covers: rule.covers,
      uncovered: rule.uncovered,
    })),
    commissionLevels: review.commissionLevels,
    notSaved: [...review.skipped, ...review.outOfScope.map(({ productName, pricing }) => `${productName} (${pricing})`)],
  };
}

export type PresentedReview = NonNullable<ReturnType<typeof presentReview>>;
