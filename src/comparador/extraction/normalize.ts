import { DAYS_PER_YEAR } from "@/comparador/engine/cost";
import { roundEuros, sumEuros } from "@/comparador/engine/money";
import { SOCIAL_BONUS_PRICES_PER_DAY } from "@/comparador/engine/regulated";
import { isValidCups, repairCups } from "./identifiers";
import type { InvoiceExtraction } from "./invoice-schema";
import { expectedTaxableBase, validateInvoice } from "./validate";

const DAYS_PER_MONTH = DAYS_PER_YEAR / 12;

/**
 * Pasa a €/kW·día las líneas de potencia que la factura da por mes o por año.
 * Lo hace nuestro código y no la IA, para que la conversión sea siempre la
 * misma: un mes son 365/12 días.
 */
export function normalizePowerLines(invoice: InvoiceExtraction): InvoiceExtraction {
  return {
    ...invoice,
    powerLines: invoice.powerLines.map((line) => {
      const original = line.originalPrice;
      if (!original) return line;

      if (original.unit === "kW·mes") {
        // Si la factura no dice los meses, salen del importe: kW × meses × precio.
        const months =
          original.months ??
          (line.kw > 0 && original.price > 0
            ? line.amount / (line.kw * original.price)
            : null);
        return {
          ...line,
          days: months !== null ? months * DAYS_PER_MONTH : line.days,
          pricePerKwDay: original.price / DAYS_PER_MONTH,
        };
      }

      return { ...line, pricePerKwDay: original.price / DAYS_PER_YEAR };
    }),
  };
}

/** Diferencia admitida entre dos importes en euros redondeados al céntimo. */
const CENT = 0.011;

/**
 * Algunas facturas solo dan el importe del IVA («Impuesto NORMAL 21%
 * (12,08 €)»), sin la base, y la IA pone ese importe como base imponible e
 * inventa otro IVA. Si las líneas, el tipo y el total cuadran entre sí (base
 * de las líneas × tipo = total − base), la base y el IVA están demostrados y
 * se corrigen. Solo cuando la factura trae esa cifra de IVA: si no, la lectura
 * es otra cosa y la validación debe seguir avisando.
 */
export function reconcileVat(invoice: InvoiceExtraction): InvoiceExtraction {
  const vat = invoice.vat;
  if (!vat || invoice.total === null) return invoice;
  const base = expectedTaxableBase(invoice);
  const exempt = sumEuros(invoice.vatExemptLines.map(({ amount }) => amount));
  const vatAmount = roundEuros(invoice.total - exempt - base);
  if (vatAmount <= 0 || Math.abs((base * vat.ratePercent) / 100 - vatAmount) > CENT) return invoice;

  const consistent = Math.abs(vat.base - base) <= CENT && Math.abs(vat.amount - vatAmount) <= CENT;
  if (consistent) return invoice;
  const readTheVat = [invoice.taxableBase, vat.base, vat.amount].some(
    (value) => value !== null && Math.abs(value - vatAmount) <= CENT,
  );
  if (!readTheVat) return invoice;

  return { ...invoice, taxableBase: base, vat: { ...vat, base, amount: vatAmount } };
}

/** Lo que solo dicen las facturas de precio indexado, PVPC incluido. */
const INDEXED_WORDS = /indexad[oa]|precio\s*diario|\bPVPC\b/i;

/** Energía en €/kWh de un periodo, con sus conceptos (peajes, cargos…) sumados. */
function energyPrice(invoice: InvoiceExtraction, period: "P2" | "P3"): number {
  return invoice.energyLines
    .filter((line) => line.period === period)
    .reduce((sum, line) => sum + line.pricePerKwh, 0);
}

/**
 * Corrige un «fixed» o «unknown» de la IA cuando la factura demuestra que es
 * indexada: lo dice el texto («producto indexado», «precio diario», PVPC), o
 * el valle cuesta más que el llano, que ninguna tarifa fija hace. Es lo que
 * se propone al comercial; él lo confirma en el estudio.
 */
export function inferPricing(invoice: InvoiceExtraction, text: string | null): InvoiceExtraction {
  if (invoice.pricing === "indexed" || invoice.pricing === "flat") return invoice;
  const llano = energyPrice(invoice, "P2");
  const valleOverLlano = llano > 0 && energyPrice(invoice, "P3") > llano + 0.001;
  if (valleOverLlano || (text !== null && INDEXED_WORDS.test(text))) {
    return { ...invoice, pricing: "indexed" };
  }
  return invoice;
}

/**
 * Sin fechas en la factura (Jazztel: «Alquiler contador 0,026630 €/día × 31»),
 * los días del periodo salen de lo que se cobra por día: el alquiler del
 * contador, el bono social o la potencia en €/kW·día. Solo si coinciden.
 */
export function fillBillingDays(invoice: InvoiceExtraction): InvoiceExtraction {
  if (invoice.billingPeriod) return invoice;
  const daily = [
    invoice.meterRental?.days,
    ...invoice.socialBonusLines.map(({ days }) => days),
    ...invoice.powerLines.filter(({ originalPrice }) => !originalPrice).map(({ days }) => days),
  ].filter((days): days is number => typeof days === "number" && Number.isInteger(days) && days > 0);
  const values = new Set(daily);
  if (values.size !== 1) return invoice;
  return { ...invoice, billingPeriod: { from: null, to: null, days: [...values][0] } };
}

/**
 * Un único precio de energía para todo el consumo (Repsol: «294 kWh x
 * 0,111681 €/kWh») a veces llega como P1. Si la línea cubre los kWh de los
 * tres periodos, es un precio para todos: ALL.
 */
export function singleEnergyPriceAsAll(invoice: InvoiceExtraction): InvoiceExtraction {
  const periods = new Set(invoice.energyLines.map(({ period }) => period));
  if (periods.size !== 1 || periods.has("ALL")) return invoice;
  const { P1, P2, P3 } = invoice.consumptionKwh;
  const [period] = periods;
  const others = (["P1", "P2", "P3"] as const).filter((other) => other !== period);
  if (!others.some((other) => (invoice.consumptionKwh[other] ?? 0) > 0)) return invoice;
  const total = (P1 ?? 0) + (P2 ?? 0) + (P3 ?? 0);
  const covered = invoice.energyLines.every(({ kwh }) => Math.abs(kwh - total) <= 1);
  if (!covered) return invoice;
  return { ...invoice, energyLines: invoice.energyLines.map((line) => ({ ...line, period: "ALL" as const })) };
}

type Placement = "electricity" | "taxable" | "separate" | "exempt" | "drop";
interface Movable {
  description: string;
  amount: number;
  /** Dónde lo puso la IA, y dónde más puede ir. */
  options: Placement[];
}

/** Hasta aquí se prueban todas las combinaciones (4^6 × 2). */
const MAX_MOVABLE = 6;

const CHAIN_ISSUES = new Set([
  "electricity_tax_base_mismatch",
  "electricity_tax_mismatch",
  "taxable_base_mismatch",
  "vat_mismatch",
  "total_mismatch",
]);

/**
 * Las cifras que imprime la factura mandan: el impuesto eléctrico, el IVA y
 * el total. Si la lectura no cuadra con ellas, prueba a recolocar lo dudoso:
 * - un descuento que se aplica después del impuesto eléctrico (Yoigo);
 * - un concepto con o sin impuesto eléctrico, o una línea que no suma (un
 *   anuncio: «Protege tu hogar por 3,90€/mes»);
 * - un servicio con su propio IVA, fuera de la base de la luz (TotalEnergies:
 *   «Facilita Luz»), que suma al total con su IVA;
 * - el bono social dentro o fuera de la base del impuesto eléctrico (INER,
 *   Octopus).
 * Solo cambia la lectura si una única colocación cuadra con las tres cifras;
 * las bases que la IA rellenó sin estar impresas salen de las líneas.
 */
export function reconcileChain(invoice: InvoiceExtraction): InvoiceExtraction {
  const tax = invoice.electricityTax;
  const vat = invoice.vat;
  if (!tax || !vat || invoice.total === null) return invoice;
  if (!validateInvoice(invoice).some(({ code }) => CHAIN_ISSUES.has(code))) return invoice;

  const movable: Movable[] = [
    ...invoice.energyDiscounts.map((line) => ({ ...line, options: ["electricity", "taxable"] as Placement[] })),
    ...invoice.otherElectricityLines.map((line) => ({
      ...line,
      options: ["electricity", "taxable", "separate", "drop"] as Placement[],
    })),
    ...invoice.otherTaxableLines.map((line) => ({
      ...line,
      options: ["taxable", "electricity", "separate", "drop"] as Placement[],
    })),
    // Una línea sin IVA puede ser informativa (Endesa: «Batería Virtual»,
    // lo que se acumula no se descuenta en esta factura).
    ...invoice.vatExemptLines.map((line) => ({ ...line, options: ["exempt", "drop"] as Placement[] })),
  ];
  if (movable.length > MAX_MOVABLE) return invoice;

  const lines = sumEuros([
    ...invoice.powerLines.map(({ amount }) => amount),
    ...invoice.energyLines.map(({ amount }) => amount),
  ]);
  const bonus = sumEuros(invoice.socialBonusLines.map(({ amount }) => amount));
  const rental = invoice.meterRental?.amount ?? 0;
  const withVat = (amount: number) => roundEuros((amount * (100 + vat.ratePercent)) / 100);

  const solve = (placements: Placement[], bonusOutside: boolean) => {
    const on = (where: Placement) => movable.filter((_, index) => placements[index] === where).map(({ amount }) => amount);
    const electricityBase = sumEuros([lines, bonusOutside ? 0 : bonus, ...on("electricity")]);
    if (Math.abs((electricityBase * tax.ratePercent) / 100 - tax.amount) > CENT) return null;
    const taxableBase = sumEuros([electricityBase, tax.amount, rental, bonusOutside ? bonus : 0, ...on("taxable")]);
    if (Math.abs((taxableBase * vat.ratePercent) / 100 - vat.amount) > CENT) return null;
    const separate = on("separate").map(withVat);
    if (Math.abs(sumEuros([taxableBase, vat.amount, ...on("exempt"), ...separate]) - invoice.total!) > CENT) return null;
    return { electricityBase, taxableBase };
  };

  const solutions = new Map<string, { placements: Placement[]; electricityBase: number; taxableBase: number }>();
  const visit = (placements: Placement[]) => {
    if (placements.length === movable.length) {
      for (const bonusOutside of bonus > 0 ? [false, true] : [false]) {
        const result = solve(placements, bonusOutside);
        if (!result) continue;
        const moved = movable
          .map(({ amount }, index) => `${placements[index]}:${amount}`)
          .filter((entry) => !/^(electricity|taxable|exempt):/.test(entry))
          .sort();
        const key = `${result.electricityBase}|${result.taxableBase}|${moved.join(",")}`;
        if (!solutions.has(key)) solutions.set(key, { placements, ...result });
      }
      return;
    }
    for (const option of movable[placements.length].options) visit([...placements, option]);
  };
  visit([]);
  if (solutions.size !== 1) return invoice;

  const [{ placements, electricityBase, taxableBase }] = solutions.values();
  const discountCount = invoice.energyDiscounts.length;
  const placed = movable.map(({ description, amount }, index) => ({
    line: { description, amount },
    where: placements[index],
    wasDiscount: index < discountCount,
  }));
  return {
    ...invoice,
    // Un descuento que sigue antes del impuesto eléctrico se queda como descuento.
    energyDiscounts: placed.filter(({ where, wasDiscount }) => where === "electricity" && wasDiscount).map(({ line }) => line),
    otherElectricityLines: placed.filter(({ where, wasDiscount }) => where === "electricity" && !wasDiscount).map(({ line }) => line),
    otherTaxableLines: placed.filter(({ where }) => where === "taxable").map(({ line }) => line),
    vatExemptLines: [
      ...placed.filter(({ where }) => where === "exempt").map(({ line }) => line),
      ...placed
        .filter(({ where }) => where === "separate")
        .map(({ line }) => ({ description: `${line.description} (con su IVA)`, amount: withVat(line.amount) })),
    ],
    electricityTax: { ...tax, base: electricityBase },
    vat: { ...vat, base: taxableBase },
    taxableBase: invoice.taxableBase === null ? null : taxableBase,
  };
}

/**
 * La compensación de excedentes del autoconsumo («−260 kWh × 0,06 €/kWh»)
 * llega a veces como una línea de energía más, con los kWh en negativo o en
 * positivo. No es consumo: es un importe negativo que rebaja la base del
 * impuesto eléctrico. Va a otherElectricityLines.
 */
export function surplusCompensationAsOther(invoice: InvoiceExtraction): InvoiceExtraction {
  const isCompensation = (line: InvoiceExtraction["energyLines"][number]) =>
    line.amount < 0 &&
    (line.kwh < 0 || invoice.hasSelfConsumption) &&
    Math.abs(Math.abs(line.kwh * line.pricePerKwh) - Math.abs(line.amount)) <= CENT;
  const compensations = invoice.energyLines.filter(isCompensation);
  if (compensations.length === 0) return invoice;
  return {
    ...invoice,
    hasSelfConsumption: true,
    energyLines: invoice.energyLines.filter((line) => !isCompensation(line)),
    otherElectricityLines: [
      ...invoice.otherElectricityLines,
      ...compensations.map((line) => ({
        description: `Compensación de excedentes (${Math.abs(line.kwh)} kWh × ${line.pricePerKwh} €/kWh)`,
        amount: line.amount,
      })),
    ],
  };
}

/**
 * Una línea de energía con los kWh redondeados («408 kWh» donde la factura
 * multiplica 408,35): si otra línea del mismo periodo, o su consumo, trae un
 * valor que hace cuadrar kWh × precio con el importe, se usa ese.
 */
export function alignEnergyKwh(invoice: InvoiceExtraction): InvoiceExtraction {
  let changed = false;
  const energyLines = invoice.energyLines.map((line) => {
    if (Math.abs(line.kwh * line.pricePerKwh - line.amount) <= CENT) return line;
    const candidates = new Set(
      [
        ...invoice.energyLines.filter((other) => other.period === line.period).map(({ kwh }) => kwh),
        line.period === "ALL" ? null : invoice.consumptionKwh[line.period],
      ].filter((kwh): kwh is number => kwh !== null && kwh !== line.kwh && Math.abs(kwh - line.kwh) < 1),
    );
    const matching = [...candidates].filter((kwh) => Math.abs(kwh * line.pricePerKwh - line.amount) <= CENT);
    if (matching.length !== 1) return line;
    changed = true;
    return { ...line, kwh: matching[0] };
  });
  return changed ? { ...invoice, energyLines } : invoice;
}

/** Tipo general del impuesto eléctrico. */
export const ELECTRICITY_TAX_RATE = 5.11269632;

/**
 * Muchas facturas imprimen el tipo del impuesto eléctrico redondeado («5,1 %»,
 * «5,11 %»). Es el general, 5,11269632 %: con el redondeado, base × tipo no
 * da el importe impreso.
 */
export function exactElectricityTaxRate(invoice: InvoiceExtraction): InvoiceExtraction {
  const tax = invoice.electricityTax;
  if (!tax || tax.ratePercent === ELECTRICITY_TAX_RATE || Math.abs(tax.ratePercent - ELECTRICITY_TAX_RATE) > 0.02) {
    return invoice;
  }
  return { ...invoice, electricityTax: { ...tax, ratePercent: ELECTRICITY_TAX_RATE } };
}

/**
 * Una línea de energía sin precio impreso (PVPC: «Coste de la energía …
 * 12,35 €» con sus kWh): el precio efectivo es el importe entre los kWh.
 */
export function deriveMissingEnergyPrice(invoice: InvoiceExtraction): InvoiceExtraction {
  const missing = (line: InvoiceExtraction["energyLines"][number]) => line.pricePerKwh === 0 && line.amount > 0 && line.kwh > 0;
  if (!invoice.energyLines.some(missing)) return invoice;
  return {
    ...invoice,
    energyLines: invoice.energyLines.map((line) =>
      missing(line) ? { ...line, pricePerKwh: Math.round((line.amount / line.kwh) * 1e6) / 1e6 } : line,
    ),
  };
}

const RENTAL_LINE =
  /alquiler[^\n]*?(\d+)\s*d[ií]as?\s*[x×*]\s*(\d+[.,]\d+)\s*(?:€|eur)\s*\/\s*d[ií]a[^\n]*?(\d+[.,]\d{2})\s*€/gi;
const toNumber = (text: string) => Number(text.replace(/\./g, "").replace(",", "."));

/**
 * El alquiler del contador partido en tramos de días (Endesa: «26 días x
 * 0,026630 Eur/día … 0,69 €» y «7 días x … 0,19 €»): la ficha lleva uno solo,
 * así que se suman días e importes si todos los tramos tienen el mismo precio.
 */
export function meterRentalFromText(invoice: InvoiceExtraction, text: string | null): InvoiceExtraction {
  if (!text) return invoice;
  const lines = [...text.matchAll(RENTAL_LINE)].map(([, days, price, amount]) => ({
    days: Number(days),
    price: toNumber(price),
    amount: toNumber(amount),
  }));
  if (lines.length < 2 || new Set(lines.map(({ price }) => price)).size !== 1) return invoice;
  if (lines.some(({ days, price, amount }) => Math.abs(days * price - amount) > CENT)) return invoice;
  const amount = sumEuros(lines.map((line) => line.amount));
  if (invoice.meterRental && Math.abs(invoice.meterRental.amount - amount) <= CENT) return invoice;
  return {
    ...invoice,
    meterRental: { days: lines.reduce((sum, line) => sum + line.days, 0), pricePerDay: lines[0].price, amount },
  };
}

/**
 * El bono social impreso por año («31 días × 9,011295 €/año = 0,77 €») sale
 * mal pasado a €/día. Si la línea no cuadra y un único precio regulado por
 * día, por sus días, da el importe impreso, se usa ese.
 */
export function regulatedSocialBonusPrice(invoice: InvoiceExtraction): InvoiceExtraction {
  let changed = false;
  const socialBonusLines = invoice.socialBonusLines.map((line) => {
    if (line.days === null || line.pricePerDay === null) return line;
    if (Math.abs(line.days * line.pricePerDay - line.amount) <= CENT) return line;
    const matching = SOCIAL_BONUS_PRICES_PER_DAY.filter((price) => Math.abs(line.days! * price - line.amount) <= CENT);
    if (matching.length !== 1) return line;
    changed = true;
    return { ...line, pricePerDay: matching[0] };
  });
  return changed ? { ...invoice, socialBonusLines } : invoice;
}

/**
 * El CUPS que lee la IA de una imagen puede traer una cifra mal: si una única
 * corrección hace cuadrar sus letras de control, se usa ese. El SIPS confirma
 * después que el suministro existe.
 */
export function repairedCups(invoice: InvoiceExtraction): InvoiceExtraction {
  if (!invoice.cups || isValidCups(invoice.cups)) return invoice;
  const cups = repairCups(invoice.cups);
  return cups ? { ...invoice, cups } : invoice;
}
