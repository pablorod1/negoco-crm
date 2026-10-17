import path from "node:path";
import type { ReactNode } from "react";
import { Circle, Document, Font, Image, Page, Polyline, renderToBuffer, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import type { CostBreakdown, EnergyByPeriod, TariffPrices } from "@/comparador/engine/types";
import type { ProposalDocument, ProposalOffer } from "@/comparador/study/proposals";
import type { SupplyReading } from "@/comparador/study/supply";

/** Marca del tenant en el PDF. El logo solo si es PNG o JPEG (lo que admite el PDF). */
export interface ProposalBranding {
  displayName: string;
  logo: Buffer | null;
  color: string;
}

const TERRITORY: Record<string, string> = {
  peninsula: "Península",
  baleares: "Baleares",
  canarias: "Canarias",
  ceuta_melilla: "Ceuta y Melilla",
};

const euros = (value: number, decimals = 2) =>
  `${value < 0 ? "−" : ""}${Math.abs(value).toLocaleString("es-ES", { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: "always" })} €`;
/** Diferencia con signo: «−66,44 €» ahorra, «+3,10 €» cuesta más. */
const delta = (value: number) =>
  Math.abs(value) < 0.005 ? "=" : `${value < 0 ? "−" : "+"}${euros(Math.abs(value))}`;
/** Precio del kWh redondeado, para leerlo de un vistazo: «0,270». */
const price3 = (value: number) => value.toLocaleString("es-ES", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
/** Precio unitario con 4 a 6 decimales: 0,2149 en vez de 0,214900. */
const price = (value: number) =>
  value.toLocaleString("es-ES", { minimumFractionDigits: 4, maximumFractionDigits: 6 });
const kw = (value: number) => `${value.toLocaleString("es-ES", { maximumFractionDigits: 3 })} kW`;
const kwh = (value: number) => `${Math.round(value).toLocaleString("es-ES", { useGrouping: "always" })} kWh`;
/** Variación en %: «−43 %», «+2 %», «=». */
const change = (from: number, to: number) => {
  if (from <= 0) return "";
  const percent = Math.round(((to - from) / from) * 100);
  return percent === 0 ? "=" : `${percent < 0 ? "−" : "+"}${Math.abs(percent)} %`;
};
const longDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Madrid",
  });
/** «mayo de 2025». */
const monthName = (month: string) =>
  new Date(`${month}-15T12:00:00Z`).toLocaleDateString("es-ES", { month: "long", year: "numeric", timeZone: "Europe/Madrid" });

const INK = "#0f172a";
const TEXT = "#334155";
const MUTED = "#64748b";
const LINE = "#e2e8f0";
const SOFT = "#f8fafc";
const GOOD = "#047857";
const GOOD_SOFT = "#ecfdf5";
const BAD = "#b91c1c";
const BAD_SOFT = "#fef2f2";
const WARN = "#f59e0b";
const WARN_SOFT = "#fffbeb";
const INFO = "#6366f1";
const INFO_SOFT = "#eef2ff";
/**
 * «Hoy»: siempre rojo claro, para que se vea lo que paga de más con su
 * comercializadora (Beenergy, 17-10-2026). «Propuesta»: el color de la marca.
 */
const TODAY = "#b91c1c";
/** Bandas, barras y el total de hoy, con `TODAY_ON` encima. */
const TODAY_FILL = "#fca5a5";
const TODAY_ON = "#7f1d1d";
const TODAY_SOFT = "#fef2f2";
/** Lo que no es ni hoy ni la propuesta: la potencia contratada, avisos sin tono. */
const NEUTRAL = "#64748b";
const NEUTRAL_BAR = "#94a3b8";
const NEUTRAL_SOFT = "#f1f5f9";

/** El color de la marca mezclado con blanco (amount 1 = el color, 0 = blanco). */
function tint(hex: string, amount: number): string {
  return mix(hex, "#ffffff", amount);
}

function mix(hex: string, other: string, amount: number): string {
  const [a, b] = [rgb(hex), rgb(other)];
  return `#${a.map((channel, index) => Math.round(channel * amount + b[index] * (1 - amount)).toString(16).padStart(2, "0")).join("")}`;
}

function rgb(color: string): [number, number, number] {
  const value = color.trim();
  const fn = value.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i);
  if (fn) return [Number(fn[1]), Number(fn[2]), Number(fn[3])];
  let hex = value.replace("#", "");
  if (hex.length === 3 || hex.length === 4) hex = [...hex.slice(0, 3)].map((char) => char + char).join("");
  return [0, 2, 4].map((index) => parseInt(hex.slice(index, index + 2), 16) || 0) as [number, number, number];
}

function luminance(color: string): number {
  const [r, g, b] = rgb(color).map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const contrast = (a: string, b: string) => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
};

interface Palette {
  /** El color tal cual, para rellenos. */
  brand: string;
  /** El color oscurecido hasta leerse sobre blanco, para textos y cifras. */
  ink: string;
  /** Texto encima de un relleno de la marca: blanco, o casi negro si la marca es clara. */
  on: string;
  soft: string;
  line: string;
  mid: string;
}

/**
 * La paleta sale del color del tenant. Un color claro (un amarillo) no se lee
 * como texto sobre blanco ni admite texto blanco encima: se oscurece para los
 * textos y lleva texto oscuro en los rellenos.
 */
export function brandPalette(color: string): Palette {
  const brand = `#${rgb(color).map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
  let ink = brand;
  for (let step = 0; step < 20 && contrast(ink, "#ffffff") < 4.5; step++) ink = mix(ink, "#000000", 0.9);
  return {
    brand,
    ink,
    on: contrast(brand, "#ffffff") >= 3 ? "#ffffff" : INK,
    soft: tint(brand, 0.08),
    line: tint(brand, 0.3),
    mid: tint(brand, 0.55),
  };
}

const styles = StyleSheet.create({
  page: { paddingTop: 26, paddingHorizontal: 36, paddingBottom: 50, fontSize: 9, fontFamily: "Inter", color: TEXT },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  logo: { height: 30, maxWidth: 170, objectFit: "contain", objectPositionX: 0 },
  brandName: { fontSize: 15, fontWeight: 600 },
  headerRight: { alignItems: "flex-end" },
  kicker: { fontSize: 7.5, fontWeight: 600, letterSpacing: 0.9, textTransform: "uppercase" },
  muted: { color: MUTED },
  small: { fontSize: 7.5 },
  tiny: { fontSize: 6.8 },
  bold: { fontWeight: 600, color: INK },
  pageTitle: { fontSize: 19, fontWeight: 600, color: INK, marginTop: 16 },
  pageLead: { color: MUTED, marginTop: 3, fontSize: 9.5 },
  meta: { flexDirection: "row", flexWrap: "wrap", marginTop: 7 },
  metaItem: { fontSize: 7.5, color: TEXT, backgroundColor: SOFT, borderWidth: 1, borderColor: LINE, borderRadius: 9, paddingVertical: 2, paddingHorizontal: 7, marginRight: 4, marginBottom: 3 },

  hero: { marginTop: 12, borderRadius: 12, paddingVertical: 16, paddingHorizontal: 18, flexDirection: "row", alignItems: "center" },
  heroValue: { fontSize: 32, fontWeight: 600, marginTop: 1 },
  calendar: { width: 150, marginLeft: 14 },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 5 },
  calendarCell: { width: 21, height: 17, borderRadius: 3, marginRight: 3, marginBottom: 3, alignItems: "center", justifyContent: "center" },

  section: { marginTop: 12 },
  sectionTitle: { fontSize: 10.5, fontWeight: 600, color: INK },
  sectionLead: { fontSize: 7.5, color: MUTED, marginTop: 1, marginBottom: 6 },

  ribbonRow: { flexDirection: "row", alignItems: "center", marginBottom: 5 },
  ribbonLabel: { width: 92 },
  ribbonTrack: { flex: 1, height: 22, flexDirection: "row" },
  ribbonBar: { height: 22, borderRadius: 4, justifyContent: "center", paddingHorizontal: 7 },
  ribbonAside: { width: 84, paddingLeft: 8, fontWeight: 600 },

  cards: { flexDirection: "row", gap: 10, marginTop: 12 },
  card: { flex: 1, borderRadius: 8, borderWidth: 1, overflow: "hidden" },
  cardBand: { paddingVertical: 4, paddingHorizontal: 10 },
  cardBandText: { fontSize: 7.5, fontWeight: 600, letterSpacing: 0.9, textTransform: "uppercase" },
  cardBody: { paddingVertical: 8, paddingHorizontal: 10 },
  cardName: { fontSize: 11, fontWeight: 600, color: INK },
  cardAmount: { fontSize: 18, fontWeight: 600, marginTop: 6 },
  cardLine: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.5, borderTopWidth: 1, borderTopColor: LINE },
  chips: { flexDirection: "row", flexWrap: "wrap", marginTop: 5 },
  chip: { fontSize: 7, borderRadius: 9, paddingVertical: 2, paddingHorizontal: 6, marginRight: 4, marginBottom: 3 },

  driver: { flexDirection: "row", alignItems: "center", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: LINE },
  driverLabel: { width: 112 },
  driverTrack: { flex: 1, height: 9, flexDirection: "row", justifyContent: "flex-end", marginRight: 8 },
  driverAmount: { width: 62, textAlign: "right", fontWeight: 600 },
  driverWhy: { width: 150, fontSize: 7.2, color: MUTED, paddingLeft: 8 },

  tiles: { flexDirection: "row", gap: 8, marginTop: 10 },
  tile: { flex: 1, borderWidth: 1, borderColor: LINE, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 9 },
  tileValue: { fontSize: 13, fontWeight: 600, color: INK, marginTop: 3 },

  chart: { flexDirection: "row", alignItems: "flex-end", borderBottomWidth: 1, borderBottomColor: LINE },
  chartColumn: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  chartAxis: { flexDirection: "row" },
  legend: { flexDirection: "row", flexWrap: "wrap", marginTop: 6 },
  legendItem: { flexDirection: "row", alignItems: "center", marginRight: 12 },
  legendSwatch: { width: 8, height: 8, borderRadius: 2, marginRight: 4 },

  periods: { flexDirection: "row", gap: 8 },
  period: { flex: 1, borderWidth: 1, borderColor: LINE, borderRadius: 8, overflow: "hidden" },
  periodHead: { paddingVertical: 6, paddingHorizontal: 9 },
  periodBody: { paddingVertical: 7, paddingHorizontal: 9 },

  meter: { height: 12, borderRadius: 6, backgroundColor: NEUTRAL_SOFT, marginTop: 4, overflow: "hidden" },

  headRow: { flexDirection: "row" },
  headCell: { fontSize: 7.5, fontWeight: 600, paddingVertical: 4 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: LINE },
  groupHead: { fontSize: 7, fontWeight: 600, color: MUTED, letterSpacing: 0.6, textTransform: "uppercase", paddingLeft: 5, paddingBottom: 2 },
  cellLabel: { flex: 2.1, paddingLeft: 5, paddingVertical: 2.6 },
  cell: { flex: 1, textAlign: "right", paddingRight: 6, paddingVertical: 2.6 },
  totalRow: { flexDirection: "row", marginTop: 3, borderRadius: 5, overflow: "hidden" },

  options: { flexDirection: "row", gap: 8, marginTop: 10 },

  note: { marginTop: 7, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 9, borderLeftWidth: 3 },
  noteTitle: { fontWeight: 600, color: INK, marginBottom: 2 },

  steps: { flexDirection: "row", gap: 8 },
  step: { flex: 1, borderRadius: 8, padding: 9 },
  stepNumber: { width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", marginBottom: 5 },

  footer: {
    position: "absolute",
    left: 36,
    right: 36,
    bottom: 18,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: LINE,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 6.8,
    color: MUTED,
  },
});

/** Los tres periodos de la 2.0TD con su horario. Ceuta y Melilla van una hora más tarde. */
function periodInfo(territory: string) {
  const late = territory === "ceuta_melilla";
  return [
    { key: "P1" as const, name: "Punta", hours: late ? "Lun–vie de 11 a 15 h y de 19 a 23 h" : "Lun–vie de 10 a 14 h y de 18 a 22 h" },
    { key: "P2" as const, name: "Llano", hours: late ? "Lun–vie de 8 a 11 h, de 15 a 19 h y de 23 a 24 h" : "Lun–vie de 8 a 10 h, de 14 a 18 h y de 22 a 24 h" },
    { key: "P3" as const, name: "Valle", hours: "De 0 a 8 h, y fines de semana y festivos todo el día" },
  ];
}

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);
/** Propuesta de gas: término fijo y variable, peaje RL, sin potencia ni periodos. */
const isGas = (doc: ProposalDocument) => doc.supply.energy === "gas";
/** «luz» o «gas», para los textos. */
const energyWord = (doc: ProposalDocument) => (isGas(doc) ? "gas" : "luz");
const totalKwh = (energy: EnergyByPeriod) => energy.P1 + energy.P2 + energy.P3;

/** Coste que no depende de los kWh: se reparte por días. */
const fixedPart = (cost: CostBreakdown) =>
  cost.power.total + cost.meterRental + cost.services + (cost.flatFee ?? 0) + cost.socialBonus + cost.otherElectricity;
/** Coste que va con los kWh: se reparte por el consumo de cada mes. */
const variablePart = (cost: CostBreakdown) => cost.energy.total + sum(cost.energyDiscounts) + (cost.ancillary ?? 0);

interface MonthPoint {
  label: string;
  year: string;
  days: number;
  kwh: EnergyByPeriod;
}

/** Cada lectura del SIPS con el mes en que cae la mayor parte de sus días. */
function monthsFromReadings(readings: readonly SupplyReading[]): MonthPoint[] {
  return readings.map((reading) => {
    const from = Date.parse(`${reading.from}T12:00:00Z`);
    const to = Date.parse(`${reading.to}T12:00:00Z`);
    const middle = new Date((from + to) / 2);
    return {
      label: middle.toLocaleDateString("es-ES", { month: "short", timeZone: "UTC" }).replace(".", ""),
      year: String(middle.getUTCFullYear()).slice(2),
      days: Math.max(1, Math.round((to - from) / 86_400_000)),
      kwh: reading.kwh,
    };
  });
}

/**
 * El coste de un año repartido entre los meses del SIPS: lo fijo por días, la
 * energía por lo que pesa el consumo de cada mes a esos precios, y los
 * impuestos en proporción. La suma de los meses es el total del año.
 */
function monthlyCosts(months: readonly MonthPoint[], cost: CostBreakdown, prices: TariffPrices | null): number[] {
  const weight = (point: MonthPoint) =>
    prices ? point.kwh.P1 * prices.energy.P1 + point.kwh.P2 * prices.energy.P2 + point.kwh.P3 * prices.energy.P3 : totalKwh(point.kwh);
  const days = sum(months.map(({ days }) => days));
  const weights = sum(months.map(weight));
  const fixed = fixedPart(cost);
  const variable = variablePart(cost);
  const beforeTaxes = fixed + variable;
  if (beforeTaxes <= 0 || days <= 0) return months.map(() => cost.total / Math.max(1, months.length));
  return months.map((point) => {
    const share = (fixed * (point.days / days) + (weights > 0 ? variable * (weight(point) / weights) : 0)) / beforeTaxes;
    return cost.total * share;
  });
}

/** De dónde sale la diferencia de coste, por grupos de conceptos y con su porqué. */
function savingDrivers(doc: ProposalDocument) {
  const current = doc.current;
  if (!current || current.pricing === "flat") return [];
  const today = current.cost;
  const offer = doc.offer.cost;
  const annual = totalKwh(doc.supply.annualKwh);
  const gas = isGas(doc);
  const groups: { label: string; pick: (cost: CostBreakdown) => number; why: (diff: number) => string }[] = [
    {
      label: gas ? "Gas consumido" : "Energía",
      pick: variablePart,
      why: () =>
        annual > 0
          ? `El kWh le sale a ${euros(variablePart(offer) / annual, 3)} de media, frente a ${euros(variablePart(today) / annual, 3)} hoy`
          : "Precio del kWh",
    },
    {
      label: gas ? "Término fijo" : "Potencia",
      pick: (cost) => cost.power.total,
      why: () =>
        current.prices
          ? `${change(current.prices.power.P1, doc.offer.prices.power.P1).replace("=", "Mismo precio")} en el precio ${gas ? "del término fijo" : "del kW de punta"}`
          : gas
            ? "Lo que se paga cada día por tener el gas"
            : "Término fijo por los kW contratados",
    },
    {
      label: "Servicios adicionales",
      pick: (cost) => cost.services,
      why: (diff) => (offer.services === 0 && diff < 0 ? "La propuesta no le cobra servicios aparte" : `Servicios que se cobran con ${gas ? "el gas" : "la luz"}`),
    },
    { label: "Alquiler del contador", pick: (cost) => cost.meterRental, why: () => "Lo fija la distribuidora" },
    {
      label: gas ? "Otros" : "Bono social y otros",
      pick: (cost) => cost.socialBonus + cost.otherElectricity + cost.vatExempt,
      why: () => "Cargos que cobran todas las comercializadoras",
    },
    {
      label: "Impuestos",
      pick: (cost) => cost.electricityTax + cost.vat,
      why: (diff) => {
        const taxes = gas ? "Impuesto de hidrocarburos e IVA" : "Impuesto eléctrico e IVA";
        return diff < 0 ? `${taxes} bajan con la factura` : taxes;
      },
    },
  ];
  return groups
    .map((group) => ({ label: group.label, diff: group.pick(offer) - group.pick(today), why: group.why }))
    .filter(({ diff }) => Math.abs(diff) >= 0.5)
    .map((group) => ({ ...group, why: group.why(group.diff) }));
}

const offerChips = (offer: ProposalOffer) =>
  [
    offer.pricing === "indexed" ? "Precio indexado" : "Precio fijo",
    offer.termMonths ? `Contrato de ${offer.termMonths} meses` : null,
    offer.powerMode === "regulated" ? "Potencia a precio regulado (BOE)" : null,
    ...offer.discounts,
  ].filter((text): text is string => Boolean(text));

function Header({ branding, palette, generatedAt, kicker }: { branding: ProposalBranding; palette: Palette; generatedAt: string; kicker: string }) {
  return (
    <View>
      <View style={styles.header}>
        {branding.logo ? (
          // eslint-disable-next-line jsx-a11y/alt-text -- Image de react-pdf no admite alt.
          <Image src={branding.logo} style={styles.logo} />
        ) : (
          <Text style={[styles.brandName, { color: palette.ink }]}>{branding.displayName}</Text>
        )}
        <View style={styles.headerRight}>
          <Text style={[styles.kicker, { color: palette.ink }]}>{kicker}</Text>
          <Text style={[styles.muted, { marginTop: 2 }]}>{longDate(generatedAt)}</Text>
        </View>
      </View>
      <View style={{ height: 3, borderRadius: 2, backgroundColor: palette.brand, marginTop: 9 }} />
    </View>
  );
}

function Footer({ doc, branding }: { doc: ProposalDocument; branding: ProposalBranding }) {
  const who = doc.client.name ? `Estudio para ${doc.client.name}` : `Estudio de su factura de ${energyWord(doc)}`;
  return (
    <View style={styles.footer} fixed>
      <Text>
        {who} · Precios a {longDate(doc.priceDate)} · {branding.displayName}
      </Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function SectionTitle({ title, lead }: { title: string; lead?: string }) {
  return (
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      {lead ? <Text style={styles.sectionLead}>{lead}</Text> : <View style={{ height: 6 }} />}
    </View>
  );
}

/**
 * El ahorro en grande y, al lado, los meses de luz que equivale: doce
 * casillas, las que paga el ahorro en verde. Si la propuesta sale más cara,
 * en rojo y con lo que pagaría de más: un estudio que no ahorra se ve.
 */
function Hero({ doc, palette }: { doc: ProposalDocument; palette: Palette }) {
  const { savings, current, offer } = doc;
  const percentOf = (amount: number) => (current && current.cost.total > 0 ? Math.round((amount / current.cost.total) * 100) : null);
  if (savings !== null && savings <= -0.5 && current !== null) {
    const extra = -savings;
    const percent = percentOf(extra);
    return (
      <View style={[styles.hero, { backgroundColor: BAD }]} wrap={false}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: "#ffffff", opacity: 0.9 }}>Con esta propuesta pagaría más cada año</Text>
          <Text style={[styles.heroValue, { color: "#ffffff" }]}>+{euros(extra)}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
            {percent !== null && (
              <Text style={{ backgroundColor: "#ffffff", color: BAD, fontWeight: 600, borderRadius: 8, paddingVertical: 2, paddingHorizontal: 7, marginRight: 7 }}>
                +{percent} %
              </Text>
            )}
            <Text style={{ color: "#ffffff" }}>{euros(extra / 12)} más al mes, impuestos incluidos</Text>
          </View>
        </View>
      </View>
    );
  }
  const saves = savings !== null && savings > 0 && current !== null;
  if (!saves) {
    return (
      <View style={[styles.hero, { backgroundColor: palette.brand }]} wrap={false}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: palette.on, opacity: 0.9 }}>Coste estimado de un año con la propuesta</Text>
          <Text style={[styles.heroValue, { color: palette.on }]}>{euros(offer.cost.total)}</Text>
          <Text style={{ color: palette.on, marginTop: 2 }}>Unos {euros(offer.cost.total / 12)} al mes, impuestos incluidos</Text>
        </View>
      </View>
    );
  }
  const monthlyToday = current.cost.total / 12;
  const freeMonths = monthlyToday > 0 ? Math.min(12, Math.round((savings / monthlyToday) * 2) / 2) : 0;
  const percent = percentOf(savings);
  const monthsText = freeMonths === 0.5 ? "medio mes" : `${freeMonths.toLocaleString("es-ES")} ${freeMonths === 1 ? "mes" : "meses"}`;
  return (
    <View style={[styles.hero, { backgroundColor: GOOD }]} wrap={false}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: "#ffffff", opacity: 0.9 }}>Le ahorramos cada año</Text>
        <Text style={[styles.heroValue, { color: "#ffffff" }]}>{euros(savings)}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
          {percent !== null && (
            <Text style={{ backgroundColor: "#ffffff", color: GOOD, fontWeight: 600, borderRadius: 8, paddingVertical: 2, paddingHorizontal: 7, marginRight: 7 }}>
              −{percent} %
            </Text>
          )}
          <Text style={{ color: "#ffffff" }}>{euros(savings / 12)} menos al mes, impuestos incluidos</Text>
        </View>
      </View>
      {freeMonths >= 0.5 && (
        <View style={styles.calendar}>
          <Text style={{ color: "#ffffff", fontWeight: 600 }}>
            Como no pagar {isGas(doc) ? "el gas" : "la luz"} {monthsText} al año
          </Text>
          <View style={styles.calendarGrid}>
            {["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"].map((letter, index) => {
              const filled = Math.min(1, Math.max(0, freeMonths - index));
              return (
                <View
                  key={index}
                  style={[
                    styles.calendarCell,
                    { backgroundColor: filled === 1 ? "#ffffff" : filled > 0 ? "#a7f3d0" : "rgba(255,255,255,0.18)" },
                  ]}
                >
                  <Text style={{ fontSize: 7, fontWeight: 600, color: filled > 0 ? GOOD : "#ffffff" }}>{letter}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}
      {freeMonths < 0.5 && percent !== null && (
        <View style={{ borderRadius: 14, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: "#ffffff" }}>
          <Text style={{ fontSize: 16, fontWeight: 600, color: GOOD }}>−{percent} %</Text>
          <Text style={[styles.small, { color: GOOD, textAlign: "center" }]}>que hoy</Text>
        </View>
      )}
    </View>
  );
}

/**
 * Hoy y la propuesta en barras a escala: lo que deja de pagar queda a la
 * vista. La diferencia va escrita al lado, fuera de la barra: dentro no cabía
 * cuando era pequeña («−30…»).
 */
function Ribbon({ doc, palette }: { doc: ProposalDocument; palette: Palette }) {
  const current = doc.current;
  if (!current) return null;
  const today = current.cost.total;
  const offer = doc.offer.cost.total;
  const max = Math.max(today, offer) || 1;
  const saving = today - offer;
  return (
    <View style={styles.section} wrap={false}>
      <SectionTitle title="Lo que paga hoy y lo que pagaría" lead="Un año, con su consumo real y todos los impuestos" />
      <View style={styles.ribbonRow}>
        <Text style={[styles.ribbonLabel, styles.muted]}>Hoy</Text>
        <View style={styles.ribbonTrack}>
          <View style={[styles.ribbonBar, { width: `${(today / max) * 100}%`, backgroundColor: TODAY_FILL }]}>
            <Text style={{ color: TODAY_ON, fontWeight: 600 }}>{euros(today)}</Text>
          </View>
        </View>
        <View style={styles.ribbonAside} />
      </View>
      <View style={styles.ribbonRow}>
        <Text style={[styles.ribbonLabel, styles.bold]}>Con la propuesta</Text>
        <View style={styles.ribbonTrack}>
          <View style={[styles.ribbonBar, { width: `${(offer / max) * 100}%`, backgroundColor: palette.brand }]}>
            <Text style={{ color: palette.on, fontWeight: 600 }}>{euros(offer)}</Text>
          </View>
          {saving > 0 && (
            <View
              style={[
                styles.ribbonBar,
                { width: `${(saving / max) * 100}%`, marginLeft: 2, backgroundColor: GOOD_SOFT, borderWidth: 1, borderStyle: "dashed", borderColor: GOOD },
              ]}
            />
          )}
        </View>
        {Math.abs(saving) >= 0.5 ? (
          <Text style={[styles.ribbonAside, { color: saving > 0 ? GOOD : BAD }]}>
            {saving > 0 ? `Ahorra ${euros(saving)}` : `+${euros(-saving)} más`}
          </Text>
        ) : (
          <View style={styles.ribbonAside} />
        )}
      </View>
    </View>
  );
}

/** Lo que paga cada uno al año, al mes y por kWh, todo incluido. */
function Versus({ doc, palette }: { doc: ProposalDocument; palette: Palette }) {
  const { current, offer } = doc;
  const annual = totalKwh(doc.supply.annualKwh);
  const line = (label: string, value: string, color?: string) => (
    <View style={styles.cardLine}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={[styles.bold, color ? { color } : {}]}>{value}</Text>
    </View>
  );
  const pricingLabel = current?.pricing === "indexed" ? "Tarifa indexada" : current?.pricing === "flat" ? "Tarifa plana" : "Precio fijo";
  return (
    <View style={styles.cards} wrap={false}>
      {current && (
        <View style={[styles.card, { borderColor: LINE }]}>
          <View style={[styles.cardBand, { backgroundColor: TODAY_FILL }]}>
            <Text style={[styles.cardBandText, { color: TODAY_ON }]}>Su tarifa hoy</Text>
          </View>
          <View style={[styles.cardBody, { backgroundColor: TODAY_SOFT, flexGrow: 1 }]}>
            <Text style={styles.cardName}>{current.supplierName ?? "Su comercializadora"}</Text>
            <View style={styles.chips}>
              <Text style={[styles.chip, { backgroundColor: "#ffffff", color: TODAY }]}>{pricingLabel}</Text>
            </View>
            <Text style={[styles.cardAmount, { color: TODAY, marginTop: 2 }]}>{euros(current.cost.total)}</Text>
            <Text style={[styles.small, styles.muted, { marginBottom: 5 }]}>al año</Text>
            {line("Al mes", euros(current.cost.total / 12))}
            {annual > 0 && line("Cada kWh, todo incluido", `${euros(current.cost.total / annual, 3)}`)}
          </View>
        </View>
      )}
      <View style={[styles.card, { borderColor: palette.brand, borderWidth: 1.5 }]}>
        <View style={[styles.cardBand, { backgroundColor: palette.brand }]}>
          <Text style={[styles.cardBandText, { color: palette.on }]}>Le proponemos</Text>
        </View>
        <View style={[styles.cardBody, { backgroundColor: palette.soft, flexGrow: 1 }]}>
          <Text style={styles.cardName}>
            {offer.comercializadoraName} <Text style={[styles.muted, { fontWeight: 400, fontSize: 8.5 }]}>· {offer.productName}</Text>
          </Text>
          <View style={styles.chips}>
            {offerChips(offer).map((text) => (
              <Text key={text} style={[styles.chip, { backgroundColor: "#ffffff", color: palette.ink }]}>
                {text}
              </Text>
            ))}
          </View>
          <Text style={[styles.cardAmount, { color: palette.ink, marginTop: 2 }]}>{euros(offer.cost.total)}</Text>
          <Text style={[styles.small, styles.muted, { marginBottom: 5 }]}>al año</Text>
          {line("Al mes", euros(offer.cost.total / 12))}
          {annual > 0 &&
            line(
              "Cada kWh, todo incluido",
              `${euros(offer.cost.total / annual, 3)}${current ? `  ${change(current.cost.total, offer.cost.total)}` : ""}`,
              current ? (offer.cost.total < current.cost.total ? GOOD : offer.cost.total > current.cost.total ? BAD : undefined) : undefined,
            )}
        </View>
      </View>
    </View>
  );
}

/** Cada grupo de conceptos con su diferencia en una barra, y por qué. */
function Drivers({ doc }: { doc: ProposalDocument }) {
  const drivers = savingDrivers(doc);
  if (drivers.length === 0) return null;
  const max = Math.max(...drivers.map(({ diff }) => Math.abs(diff))) || 1;
  return (
    <View style={styles.section} wrap={false}>
      <SectionTitle title="De dónde sale el ahorro" lead="Lo que cambia cada parte de la factura en un año" />
      {drivers.map((driver) => {
        const good = driver.diff < 0;
        return (
          <View key={driver.label} style={styles.driver}>
            <Text style={[styles.driverLabel, styles.bold]}>{driver.label}</Text>
            <View style={styles.driverTrack}>
              <View style={{ width: `${Math.max(2, (Math.abs(driver.diff) / max) * 100)}%`, backgroundColor: good ? GOOD : BAD, borderRadius: 2, opacity: good ? 1 : 0.8 }} />
            </View>
            <Text style={[styles.driverAmount, { color: good ? GOOD : BAD }]}>{delta(driver.diff)}</Text>
            <Text style={styles.driverWhy}>{driver.why}</Text>
          </View>
        );
      })}
    </View>
  );
}

/** Hasta tres ofertas lado a lado, frente a lo que paga hoy. La primera es la recomendada. */
function Options({ doc, palette }: { doc: ProposalDocument; palette: Palette }) {
  const options = [{ ...doc.offer, savings: doc.savings }, ...(doc.alternatives ?? [])];
  const current = doc.current;
  const max = Math.max(current?.cost.total ?? 0, ...options.map(({ cost }) => cost.total)) || 1;
  /** El coste a escala: las barras de todas las tarjetas se comparan a simple vista. */
  const bar = (total: number, color: string) => (
    <View style={[styles.meter, { height: 6, marginTop: 5, marginBottom: 6, backgroundColor: "#ffffff" }]}>
      <View style={{ width: `${(total / max) * 100}%`, height: 6, borderRadius: 3, backgroundColor: color }} />
    </View>
  );
  const line = (label: string, value: string, color?: string) => (
    <View style={styles.cardLine}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={[styles.bold, color ? { color } : {}]}>{value}</Text>
    </View>
  );
  return (
    <View style={styles.section} wrap={false}>
      <SectionTitle title={`Hemos comparado ${options.length} ofertas para usted`} lead="Mismo consumo, mismos impuestos: solo cambia la tarifa" />
      <View style={[styles.options, { marginTop: 0 }]}>
        {current && (
          <View style={[styles.card, { borderColor: LINE }]}>
            <View style={[styles.cardBand, { backgroundColor: TODAY_FILL }]}>
              <Text style={[styles.cardBandText, { color: TODAY_ON }]}>Hoy</Text>
            </View>
            <View style={[styles.cardBody, { backgroundColor: TODAY_SOFT, flexGrow: 1 }]}>
              <Text style={styles.cardName}>{current.supplierName ?? "Su tarifa actual"}</Text>
              <Text style={[styles.cardAmount, { color: TODAY }]}>{euros(current.cost.total)}</Text>
              <Text style={[styles.small, styles.muted]}>al año</Text>
              {bar(current.cost.total, TODAY_FILL)}
              {line("Al mes", euros(current.cost.total / 12))}
            </View>
          </View>
        )}
        {options.map((option, index) => {
          const saves = option.savings !== null && option.savings > 0;
          const recommended = index === 0;
          return (
            <View
              key={`${option.comercializadoraName}-${option.productName}-${index}`}
              style={[styles.card, { borderColor: recommended ? palette.brand : palette.line, borderWidth: recommended ? 2 : 1 }]}
            >
              <View style={[styles.cardBand, { backgroundColor: recommended ? palette.brand : palette.mid }]}>
                <Text style={[styles.cardBandText, { color: recommended ? palette.on : INK }]}>{recommended ? "Recomendada" : `Opción ${index + 1}`}</Text>
              </View>
              <View style={[styles.cardBody, { backgroundColor: recommended ? palette.soft : "#ffffff", flexGrow: 1 }]}>
                <Text style={styles.cardName}>{option.comercializadoraName}</Text>
                <Text style={[styles.small, styles.muted]}>{option.productName}</Text>
                <Text style={[styles.cardAmount, { color: palette.ink }]}>{euros(option.cost.total)}</Text>
                <Text style={[styles.small, styles.muted]}>al año</Text>
                {bar(option.cost.total, recommended ? palette.brand : palette.mid)}
                {line("Al mes", euros(option.cost.total / 12))}
                {option.savings !== null &&
                  line(saves ? "Ahorra" : "Pagaría más", saves ? euros(option.savings) : `+${euros(-option.savings)}`, saves ? GOOD : BAD)}
                {option.savings !== null && current && current.cost.total > 0 && saves
                  ? line("Menos que hoy", `${Math.round((option.savings / current.cost.total) * 100)} %`, GOOD)
                  : null}
                {line("Precio", option.pricing === "indexed" ? "Indexado" : "Fijo")}
                {option.termMonths ? line("Contrato", `${option.termMonths} meses`) : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function Tile({ label, value, note, color }: { label: string; value: string; note?: string; color?: string }) {
  return (
    <View style={styles.tile}>
      <Text style={[styles.small, styles.muted]}>{label}</Text>
      <Text style={[styles.tileValue, color ? { color } : {}]}>{value}</Text>
      {note ? <Text style={[styles.tiny, styles.muted, { marginTop: 2 }]}>{note}</Text> : null}
    </View>
  );
}

/** El consumo de cada lectura del SIPS, apilado por periodos. */
function MonthlyConsumption({
  months,
  colors,
  territory,
  gas = false,
}: {
  months: MonthPoint[];
  colors: Record<"P1" | "P2" | "P3", string>;
  territory: string;
  /** Gas: un solo periodo, sin punta, llano ni valle. */
  gas?: boolean;
}) {
  const height = 78;
  const max = Math.max(...months.map((point) => totalKwh(point.kwh))) || 1;
  return (
    <View style={styles.section} wrap={false}>
      <SectionTitle title="Su consumo mes a mes" lead="Lecturas reales de su contador, tal como las da la distribuidora (SIPS)" />
      <View style={[styles.chart, { height: height + 14 }]}>
        {months.map((point, index) => {
          const total = totalKwh(point.kwh);
          return (
            <View key={index} style={styles.chartColumn}>
              <Text style={[styles.tiny, styles.bold, { marginBottom: 2 }]}>{Math.round(total).toLocaleString("es-ES", { useGrouping: "always" })}</Text>
              <View style={{ width: "62%", height: (total / max) * height, borderTopLeftRadius: 2, borderTopRightRadius: 2, overflow: "hidden" }}>
                {(["P1", "P2", "P3"] as const).map((key) => (
                  <View key={key} style={{ height: total > 0 ? `${(point.kwh[key] / total) * 100}%` : 0, backgroundColor: colors[key] }} />
                ))}
              </View>
            </View>
          );
        })}
      </View>
      <MonthAxis months={months} />
      <View style={styles.legend}>
        {(gas ? [{ key: "P1" as const, name: "Gas", hours: "" }] : periodInfo(territory)).map((period) => (
          <View key={period.key} style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: colors[period.key] }]} />
            <Text style={styles.small}>{gas ? period.name : `${period.name} (${period.key})`}</Text>
          </View>
        ))}
        <Text style={[styles.small, styles.muted]}>· kWh de cada lectura</Text>
      </View>
    </View>
  );
}

function MonthAxis({ months }: { months: MonthPoint[] }) {
  return (
    <View style={styles.chartAxis}>
      {months.map((point, index) => (
        <Text key={index} style={[styles.tiny, styles.muted, { flex: 1, textAlign: "center", marginTop: 3 }]}>
          {point.label}
          {index === 0 || point.label.startsWith("ene") ? ` ${point.year}` : ""}
        </Text>
      ))}
    </View>
  );
}

/** Lo que pagaría cada mes hoy y con la propuesta, y lo que ahorra en cada uno. */
function MonthlyBills({ months, doc, palette }: { months: MonthPoint[]; doc: ProposalDocument; palette: Palette }) {
  const current = doc.current;
  if (!current) return null;
  const today = monthlyCosts(months, current.cost, current.prices);
  const offer = monthlyCosts(months, doc.offer.cost, doc.offer.prices);
  const height = 58;
  const max = Math.max(...today, ...offer) || 1;
  return (
    <View style={styles.section} wrap={false}>
      <SectionTitle title="Su factura mes a mes" lead="El coste del año repartido según lo que consumió cada mes, impuestos incluidos" />
      <View style={[styles.chart, { height }]}>
        {months.map((_, index) => (
          <View key={index} style={[styles.chartColumn, { flexDirection: "row", alignItems: "flex-end" }]}>
            <View style={{ width: 9, height: (today[index] / max) * height, backgroundColor: TODAY_FILL, borderTopLeftRadius: 2, borderTopRightRadius: 2, marginRight: 1.5 }} />
            <View style={{ width: 9, height: (offer[index] / max) * height, backgroundColor: palette.brand, borderTopLeftRadius: 2, borderTopRightRadius: 2 }} />
          </View>
        ))}
      </View>
      <MonthAxis months={months} />
      <View style={[styles.chartAxis, { marginTop: 3, backgroundColor: GOOD_SOFT, borderRadius: 4, paddingVertical: 3 }]}>
        {months.map((_, index) => {
          const saving = today[index] - offer[index];
          return (
            <Text key={index} style={[styles.tiny, { flex: 1, textAlign: "center", fontWeight: 600, color: saving >= 0 ? GOOD : BAD }]}>
              {saving >= 0 ? "−" : "+"}
              {Math.round(Math.abs(saving))} €
            </Text>
          );
        })}
      </View>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: TODAY_FILL }]} />
          <Text style={styles.small}>Hoy</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: palette.brand }]} />
          <Text style={styles.small}>Con la propuesta</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: GOOD }]} />
          <Text style={styles.small}>Ahorro de cada mes</Text>
        </View>
      </View>
    </View>
  );
}

/** Punta, llano y valle: su horario, cuánto consume en cada uno y lo que cuesta el kWh. */
function Periods({ doc, palette, colors }: { doc: ProposalDocument; palette: Palette; colors: Record<"P1" | "P2" | "P3", string> }) {
  const annual = totalKwh(doc.supply.annualKwh);
  const today = doc.current?.prices ?? null;
  return (
    <View style={styles.section} wrap={false}>
      <SectionTitle
        title="Cuándo consume y a qué precio"
        lead="La tarifa 2.0TD tiene tres tramos horarios. Precio del término de energía (€/kWh), sin potencia, impuestos ni otros conceptos"
      />
      <View style={styles.periods}>
        {periodInfo(doc.supply.territory).map((period) => {
          const value = doc.supply.annualKwh[period.key];
          const share = annual > 0 ? Math.round((value / annual) * 100) : 0;
          const offerPrice = doc.offer.prices.energy[period.key];
          const todayPrice = today?.energy[period.key];
          return (
            <View key={period.key} style={styles.period}>
              <View style={[styles.periodHead, { backgroundColor: colors[period.key] }]}>
                <Text style={{ fontWeight: 600, color: period.key === "P1" ? "#ffffff" : period.key === "P2" ? palette.on : INK }}>
                  {period.name} <Text style={{ fontWeight: 400 }}>· {period.key}</Text>
                </Text>
              </View>
              <View style={styles.periodBody}>
                <Text style={[styles.tiny, styles.muted]}>{period.hours}</Text>
                <View style={{ flexDirection: "row", alignItems: "flex-end", marginTop: 4 }}>
                  <Text style={{ fontSize: 15, fontWeight: 600, color: INK }}>{share} %</Text>
                  <Text style={[styles.small, styles.muted, { marginLeft: 4, marginBottom: 2 }]}>de su consumo · {kwh(value)}</Text>
                </View>
                <View style={[styles.meter, { height: 5, marginTop: 4 }]}>
                  <View style={{ width: `${share}%`, height: 5, backgroundColor: colors[period.key] }} />
                </View>
                <View style={[styles.cardLine, { marginTop: 5 }]}>
                  <Text style={styles.muted}>Energía hoy</Text>
                  <Text style={{ color: TODAY }}>{todayPrice === undefined ? "—" : `${price3(todayPrice)} €`}</Text>
                </View>
                <View style={styles.cardLine}>
                  <Text style={styles.muted}>Energía propuesta</Text>
                  <Text style={[styles.bold, { color: palette.ink, marginLeft: 6 }]}>
                    {price3(offerPrice)} €
                    {todayPrice !== undefined && <Text style={{ color: offerPrice <= todayPrice ? GOOD : BAD }}>  {change(todayPrice, offerPrice)}</Text>}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** La potencia contratada frente a la máxima que ha llegado a usar. */
function PowerCheck({ doc, palette }: { doc: ProposalDocument; palette: Palette }) {
  const power = doc.supply.power;
  if (!power) return null;
  const contracted = Math.max(doc.supply.contractedKw.P1, doc.supply.contractedKw.P2);
  const scale = Math.max(contracted, power.maxDemandKw, power.suggestedKw) * 1.1 || 1;
  const verdict =
    power.status === "exceeded"
      ? { title: "Le recomendamos subir la potencia", text: `Ha llegado a pedir ${kw(power.maxDemandKw)}, más de lo contratado. Con ${kw(power.suggestedKw)} evitará que salte el limitador.`, tone: WARN_SOFT, edge: WARN }
      : power.status === "oversized"
        ? { title: `Podría bajar la potencia a ${kw(power.suggestedKw)}`, text: `En el último año nunca ha pasado de ${kw(power.maxDemandKw)}. Pagaría menos de término fijo sin que salte el limitador.`, tone: GOOD_SOFT, edge: GOOD }
        : { title: "Su potencia está bien ajustada", text: `Su máxima demanda del último año fue de ${kw(power.maxDemandKw)}: no hace falta cambiarla.`, tone: SOFT, edge: NEUTRAL };
  const marks = [
    { label: "Contratada", value: contracted, color: NEUTRAL_BAR },
    { label: "Lo máximo que ha usado", value: power.maxDemandKw, color: palette.brand },
  ];
  return (
    <View style={styles.section} wrap={false}>
      <SectionTitle title="Su potencia" lead="Máxima demanda registrada por su contador en los últimos 12 meses" />
      <View style={{ flexDirection: "row", gap: 12, alignItems: "stretch" }}>
        <View style={{ flex: 1.2 }}>
          {marks.map((mark) => (
            <View key={mark.label} style={{ marginBottom: 6 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={styles.muted}>{mark.label}</Text>
                <Text style={styles.bold}>{kw(mark.value)}</Text>
              </View>
              <View style={styles.meter}>
                <View style={{ width: `${(mark.value / scale) * 100}%`, height: 12, backgroundColor: mark.color, borderRadius: 6 }} />
              </View>
            </View>
          ))}
        </View>
        <View style={[styles.note, { flex: 1, marginTop: 0, backgroundColor: verdict.tone, borderLeftColor: verdict.edge }]}>
          <Text style={styles.noteTitle}>{verdict.title}</Text>
          <Text>{verdict.text}</Text>
        </View>
      </View>
    </View>
  );
}

/** Cabeceras de las columnas «Hoy» y de cada oferta, cada una con su color. */
function HeadRow({ withToday, offers, palette, extra }: { withToday: boolean; offers: string[]; palette: Palette; extra?: string }) {
  return (
    <View style={styles.headRow}>
      <Text style={[styles.cellLabel, styles.headCell, { color: MUTED }]}>Concepto</Text>
      {withToday && <Text style={[styles.cell, styles.headCell, { color: TODAY, backgroundColor: TODAY_SOFT }]}>Hoy</Text>}
      {offers.map((label, index) => (
        <Text key={`${label}-${index}`} style={[styles.cell, styles.headCell, { color: palette.ink, backgroundColor: index === 0 ? palette.soft : undefined }]}>
          {label}
        </Text>
      ))}
      {extra && <Text style={[styles.cell, styles.headCell, { color: MUTED }]}>{extra}</Text>}
    </View>
  );
}

/** Los precios de la propuesta (y de las alternativas) frente a los de hoy. */
function PriceTable({ doc, palette, all = false }: { doc: ProposalDocument; palette: Palette; all?: boolean }) {
  const options = all ? [doc.offer, ...(doc.alternatives ?? [])] : [doc.offer];
  const today = doc.current?.prices ?? null;
  const single = options.length === 1;
  // Luz: la potencia y la energía en dos bloques separados, que se distingan
  // a simple vista (Beenergy, 17-10-2026).
  const groups: { title: string | null; rows: { label: string; pick: (prices: TariffPrices) => number }[] }[] = isGas(doc)
    ? [
        {
          title: null,
          rows: [
            { label: "Término fijo · €/día", pick: (prices) => prices.power.P1 },
            { label: "Término variable · €/kWh", pick: (prices) => prices.energy.P1 },
          ],
        },
      ]
    : [
        {
          title: "Término de potencia · €/kW día",
          rows: [
            { label: "P1 punta", pick: (prices) => prices.power.P1 },
            { label: "P2 valle", pick: (prices) => prices.power.P2 },
          ],
        },
        {
          title: "Término de energía · €/kWh",
          rows: [
            { label: "P1 punta", pick: (prices) => prices.energy.P1 },
            { label: "P2 llano", pick: (prices) => prices.energy.P2 },
            { label: "P3 valle", pick: (prices) => prices.energy.P3 },
          ],
        },
      ];
  const indexed = options.some(({ pricing }) => pricing === "indexed");
  return (
    <View style={styles.section} wrap={false}>
      <SectionTitle
        title={all ? "Precios de cada oferta" : "Precios"}
        lead={indexed ? `En las tarifas indexadas, ${isGas(doc) ? "el término variable" : "la energía"} es la media del último año` : "Sin impuestos, tal como figuran en la tarifa"}
      />
      <HeadRow
        withToday={today !== null}
        offers={single ? ["Propuesta"] : options.map(({ comercializadoraName }) => comercializadoraName)}
        palette={palette}
        extra={single && today ? "Variación" : undefined}
      />
      {groups.map((group, groupIndex) => (
        <View key={group.title ?? groupIndex} style={{ marginTop: group.title ? (groupIndex === 0 ? 3 : 8) : 0 }}>
          {group.title && <Text style={styles.groupHead}>{group.title}</Text>}
          {group.rows.map((row) => (
            <View key={row.label} style={[styles.row, group.title ? { borderTopWidth: row === group.rows[0] ? 1 : 0, borderTopColor: LINE } : {}]}>
              <Text style={styles.cellLabel}>{row.label}</Text>
              {today && <Text style={[styles.cell, { color: TODAY, backgroundColor: TODAY_SOFT }]}>{price(row.pick(today))}</Text>}
              {options.map((option, index) => (
                <Text key={`${option.comercializadoraName}-${index}`} style={[styles.cell, styles.bold, { backgroundColor: index === 0 ? palette.soft : undefined }]}>
                  {price(row.pick(option.prices))}
                </Text>
              ))}
              {single && today && (
                <Text style={[styles.cell, { fontWeight: 600, color: row.pick(doc.offer.prices) <= row.pick(today) ? GOOD : BAD }]}>
                  {change(row.pick(today), row.pick(doc.offer.prices))}
                </Text>
              )}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function costRows(current: CostBreakdown | null, offer: CostBreakdown) {
  const gas = offer.kind === "gas";
  const lines: { label: string; pick: (cost: CostBreakdown) => number }[] = gas
    ? [
        { label: "Cuota de la tarifa plana", pick: (cost) => cost.flatFee ?? 0 },
        { label: "Término fijo", pick: (cost) => cost.power.total },
        { label: "Término variable", pick: (cost) => cost.energy.total },
        { label: "Descuentos", pick: (cost) => sum(cost.energyDiscounts) },
        { label: "Impuesto de hidrocarburos", pick: (cost) => cost.electricityTax },
        { label: "Alquiler del contador", pick: (cost) => cost.meterRental },
        { label: "Servicios", pick: (cost) => cost.services },
        { label: "IVA", pick: (cost) => cost.vat },
        { label: "Conceptos sin IVA", pick: (cost) => cost.vatExempt },
      ]
    : [
    { label: "Cuota de la tarifa plana", pick: (cost) => cost.flatFee ?? 0 },
    { label: "Término de potencia", pick: (cost) => cost.power.total },
    { label: "Término de energía", pick: (cost) => cost.energy.total },
    { label: "Descuentos", pick: (cost) => sum(cost.energyDiscounts) },
    { label: "Servicios de ajuste (estimados)", pick: (cost) => cost.ancillary ?? 0 },
    { label: "Otros conceptos", pick: (cost) => cost.otherElectricity },
    { label: "Financiación del bono social", pick: (cost) => cost.socialBonus },
    { label: "Impuesto eléctrico", pick: (cost) => cost.electricityTax },
    { label: "Alquiler del contador", pick: (cost) => cost.meterRental },
    { label: "Servicios", pick: (cost) => cost.services },
    { label: "IVA", pick: (cost) => cost.vat },
    { label: "Conceptos sin IVA", pick: (cost) => cost.vatExempt },
  ];
  return lines
    .filter(({ pick }) => pick(offer) !== 0 || (current !== null && pick(current) !== 0))
    .map(({ label, pick }) => ({ label, today: current ? pick(current) : null, offer: pick(offer) }));
}

/** El coste de un año concepto a concepto: hoy, la propuesta y la diferencia. */
function CostTable({ doc, palette }: { doc: ProposalDocument; palette: Palette }) {
  const current = doc.current?.cost ?? null;
  const offer = doc.offer.cost;
  const withToday = current !== null;
  const difference = current ? offer.total - current.total : null;
  return (
    <View style={styles.section} wrap={false}>
      <SectionTitle title="Su factura de un año, concepto a concepto" />
      <HeadRow withToday={withToday} offers={["Propuesta"]} palette={palette} extra={withToday ? "Diferencia" : undefined} />
      {costRows(current, offer).map((row) => {
        const diff = row.today === null ? null : row.offer - row.today;
        return (
          <View key={row.label} style={styles.row} wrap={false}>
            <Text style={styles.cellLabel}>{row.label}</Text>
            {withToday && <Text style={[styles.cell, { color: TODAY, backgroundColor: TODAY_SOFT }]}>{row.today === null ? "—" : euros(row.today)}</Text>}
            <Text style={[styles.cell, styles.bold, { backgroundColor: palette.soft }]}>{euros(row.offer)}</Text>
            {diff !== null && (
              <Text style={[styles.cell, { fontWeight: 600, color: Math.abs(diff) < 0.005 ? MUTED : diff < 0 ? GOOD : BAD }]}>{delta(diff)}</Text>
            )}
          </View>
        );
      })}
      <View style={styles.totalRow} wrap={false}>
        <Text style={[styles.cellLabel, styles.bold, { backgroundColor: SOFT, paddingVertical: 5 }]}>Total al año, impuestos incluidos</Text>
        {withToday && <Text style={[styles.cell, { fontWeight: 600, color: TODAY_ON, backgroundColor: TODAY_FILL, paddingVertical: 5 }]}>{euros(current.total)}</Text>}
        <Text style={[styles.cell, { fontWeight: 600, color: palette.on, backgroundColor: palette.brand, paddingVertical: 5 }]}>{euros(offer.total)}</Text>
        {difference !== null && (
          <Text
            style={[
              styles.cell,
              { fontWeight: 600, paddingVertical: 5, color: difference < 0 ? GOOD : difference > 0 ? BAD : MUTED, backgroundColor: difference < 0 ? GOOD_SOFT : difference > 0 ? BAD_SOFT : SOFT },
            ]}
          >
            {delta(difference)}
          </Text>
        )}
      </View>
    </View>
  );
}

/** Precio medio del kWh de energía de una lectura, ponderado por lo que consumió en cada periodo. */
function monthPrice(prices: EnergyByPeriod, point: MonthPoint): number {
  const total = totalKwh(point.kwh);
  if (total <= 0) return (prices.P1 + prices.P2 + prices.P3) / 3;
  return (prices.P1 * point.kwh.P1 + prices.P2 * point.kwh.P2 + prices.P3 * point.kwh.P3) / total;
}

/** Ancho útil de la página A4 (595 pt menos los márgenes). */
const CONTENT_WIDTH = 523;

/** El precio de cada lectura de lo que sea indexado (hoy, la propuesta o los dos); null si no hay nada que enseñar. */
function indexedMonthly(doc: ProposalDocument, months: readonly MonthPoint[]) {
  const fits = (series: EnergyByPeriod[] | null | undefined) => (series && series.length === months.length ? series : null);
  const offerMonthly = doc.offer.pricing === "indexed" ? fits(doc.offer.monthlyEnergy) : null;
  const currentMonthly = doc.current?.pricing === "indexed" ? fits(doc.current.monthlyEnergy) : null;
  if (isGas(doc) || months.length < 3 || (!offerMonthly && !currentMonthly)) return null;
  return { offerMonthly, currentMonthly };
}

/**
 * Indexadas: el precio de la energía mes a mes, para ver los meses caros y
 * los baratos. La tarifa fija sale casi plana, y esa es la comparación
 * (Beenergy, 17-10-2026).
 */
function IndexedPrices({ doc, months, palette }: { doc: ProposalDocument; months: MonthPoint[]; palette: Palette }) {
  const monthly = indexedMonthly(doc, months);
  if (!monthly) return null;
  const { offerMonthly, currentMonthly } = monthly;
  const current = doc.current;

  const offerLine = months.map((point, index) => monthPrice(offerMonthly ? offerMonthly[index] : doc.offer.prices.energy, point));
  const todayPrices = current?.prices ?? null;
  const todayLine = currentMonthly
    ? months.map((point, index) => monthPrice(currentMonthly[index], point))
    : todayPrices
      ? months.map((point) => monthPrice(todayPrices.energy, point))
      : null;
  const series = [
    ...(todayLine ? [{ key: "today", values: todayLine, color: TODAY, indexed: Boolean(currentMonthly) }] : []),
    { key: "offer", values: offerLine, color: palette.brand, indexed: Boolean(offerMonthly) },
  ];
  const all = series.flatMap(({ values }) => values);
  const low = Math.min(...all);
  const high = Math.max(...all);
  const pad = (high - low) * 0.15 || high * 0.1 || 0.01;
  const [min, max] = [Math.max(0, low - pad), high + pad];
  const height = 50;
  const step = CONTENT_WIDTH / months.length;
  const x = (index: number) => step * (index + 0.5);
  const y = (value: number) => height - ((value - min) / (max - min)) * height;
  // Los meses más caro y más barato de la indexada (la propuesta, si lo es).
  const moving = series.find(({ key, indexed }) => indexed && key === "offer") ?? series.find(({ indexed }) => indexed)!;
  const priciest = moving.values.indexOf(Math.max(...moving.values));
  const cheapest = moving.values.indexOf(Math.min(...moving.values));
  const fullMonth = (index: number) => `${months[index].label} ${months[index].year}`;
  return (
    <View style={styles.section} wrap={false}>
      <SectionTitle
        title="Cómo se mueve el precio cada mes"
        lead="Término de energía de cada mes (€/kWh de media), sin potencia ni impuestos. Una tarifa indexada sube y baja con el mercado."
      />
      <Svg width={CONTENT_WIDTH} height={height} style={{ borderBottomWidth: 1, borderBottomColor: LINE }}>
        {series.map(({ key, values, color }) => (
          <Polyline
            key={key}
            points={values.map((value, index) => `${x(index)},${y(value)}`).join(" ")}
            stroke={color}
            strokeWidth={2}
            fill="none"
          />
        ))}
        {series.flatMap(({ key, values, color }) =>
          values.map((value, index) => <Circle key={`${key}-${index}`} cx={x(index)} cy={y(value)} r={2.2} fill={color} />),
        )}
        <Circle cx={x(priciest)} cy={y(moving.values[priciest])} r={4.5} fill="none" stroke={BAD} strokeWidth={1.5} />
        <Circle cx={x(cheapest)} cy={y(moving.values[cheapest])} r={4.5} fill="none" stroke={GOOD} strokeWidth={1.5} />
      </Svg>
      <MonthAxis months={months} />
      {series.map(({ key, values }) => (
        <View key={key} style={[styles.chartAxis, { marginTop: 2 }]}>
          {values.map((value, index) => (
            <Text key={index} style={[styles.tiny, { flex: 1, textAlign: "center", fontWeight: 600, color: key === "today" ? TODAY : palette.ink }]}>
              {price3(value)}
            </Text>
          ))}
        </View>
      ))}
      <View style={styles.legend}>
        {series.map(({ key, color, indexed }) => (
          <View key={key} style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: color }]} />
            <Text style={styles.small}>
              {key === "today" ? "Hoy" : "Con la propuesta"} · {indexed ? "indexada" : "precio fijo"}
            </Text>
          </View>
        ))}
        <Text style={[styles.small, styles.muted]}>
          · €/kWh · Más caro: <Text style={{ color: BAD, fontWeight: 600 }}>{fullMonth(priciest)}</Text> · más barato:{" "}
          <Text style={{ color: GOOD, fontWeight: 600 }}>{fullMonth(cheapest)}</Text>
        </Text>
      </View>
    </View>
  );
}

interface Note {
  title: string;
  text: string;
  tone: string;
  edge: string;
}

function Notes({ notes }: { notes: Note[] }) {
  if (notes.length === 0) return null;
  return (
    <View style={styles.section}>
      <SectionTitle title="A tener en cuenta" />
      {notes.map((note) => (
        <View key={note.title} style={[styles.note, { marginTop: 0, marginBottom: 5, backgroundColor: note.tone, borderLeftColor: note.edge }]} wrap={false}>
          <Text style={styles.noteTitle}>{note.title}</Text>
          <Text>{note.text}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Aviso de las ofertas indexadas: su energía es la que cobró la
 * comercializadora cada mes del último año, no un precio fijo.
 */
function indexedNote(offer: ProposalOffer, alternatives: readonly ProposalOffer[], currentIndexed: boolean): Note | null {
  const indexed = [offer, ...alternatives].filter(({ pricing }) => pricing === "indexed");
  if (indexed.length === 0) return null;
  const period = indexed[0].indexHistory ? `, de ${monthName(indexed[0].indexHistory.from)} a ${monthName(indexed[0].indexHistory.to)}` : "";
  const which =
    offer.pricing === "indexed" && alternatives.length === 0
      ? "La tarifa que le proponemos es indexada"
      : indexed.length === 1
        ? `${indexed[0].comercializadoraName} · ${indexed[0].productName} es una tarifa indexada`
        : "Algunas de las tarifas que le proponemos son indexadas";
  if (currentIndexed && offer.pricing === "indexed") {
    return {
      title: "Su tarifa de hoy y la que le proponemos son indexadas",
      text: `Lo de hoy se ha estimado con el mercado eléctrico (OMIE) de sus 12 meses de consumo más lo que su factura cobra por encima; la propuesta, con lo que cobró la comercializadora cada mes${period} (en la tabla, la media). Las dos suben y bajan con el mercado.`,
      tone: INFO_SOFT,
      edge: INFO,
    };
  }
  return {
    title: which,
    text: `Su energía es la que cobró la comercializadora cada mes${period}, con su consumo de esos meses (en la tabla, la media del año). Su precio sube y baja con el mercado: los próximos meses pueden ser distintos.`,
    tone: INFO_SOFT,
    edge: INFO,
  };
}

function proposalNotes(doc: ProposalDocument): Note[] {
  const { offer, current } = doc;
  const annual = totalKwh(doc.supply.annualKwh);
  const alternatives = doc.alternatives ?? [];
  return [
    // Si la propuesta también es indexada, va todo en el aviso de la propuesta.
    current?.pricing === "indexed" && isGas(doc)
      ? {
          title: "Su tarifa de gas de hoy es indexada",
          text: "Lo que paga hoy se ha calculado con el precio de su última factura en los 12 meses. Con una tarifa indexada el precio del gas sube y baja cada mes con el mercado.",
          tone: INFO_SOFT,
          edge: INFO,
        }
      : current?.pricing === "indexed" && offer.pricing !== "indexed"
      ? {
          title: "Su tarifa de hoy es indexada",
          text: "Lo que paga hoy se ha estimado con el precio del mercado eléctrico (OMIE) de sus últimos 12 meses de consumo, más lo que su factura cobra por encima del mercado. Con una tarifa indexada su precio sube y baja con el mercado.",
          tone: INFO_SOFT,
          edge: INFO,
        }
      : null,
    current?.pricing === "flat"
      ? {
          title: "Su tarifa de hoy es una tarifa plana",
          text: "Hoy paga una cuota fija al mes. Si supera el consumo anual pactado, su comercializadora le repercutirá el coste del exceso al final del contrato.",
          tone: WARN_SOFT,
          edge: WARN,
        }
      : null,
    doc.supply.consumptionSource !== "sips"
      ? {
          title: "Estudio con el consumo estimado",
          text: `No tenemos los 12 meses de consumo de su contador: el de un año sale de su factura${doc.supply.estimate ? ` de ${doc.supply.estimate.invoiceDays} días` : ""}. El ahorro es una estimación y lo que pague dependerá de su consumo real${isGas(doc) ? ", que en el gas cambia mucho entre invierno y verano" : ""}.`,
          tone: WARN_SOFT,
          edge: WARN,
        }
      : null,
    indexedNote(offer, alternatives, current?.pricing === "indexed" && !isGas(doc)),
    offer.ancillarySimulated && (offer.cost.ancillary ?? 0) > 0
      ? {
          title: "Servicios de ajuste estimados",
          text: `Esta tarifa cobra aparte los servicios de ajuste del sistema, que varían cada mes. El coste incluye una estimación de ${euros(offer.cost.ancillary ?? 0)} al año${annual > 0 ? ` (${(Math.round(((offer.cost.ancillary ?? 0) / annual) * 1000 * 100) / 100).toLocaleString("es-ES")} €/MWh)` : ""}.`,
          tone: SOFT,
          edge: NEUTRAL,
        }
      : null,
    offer.needsAncillary
      ? {
          title: "Servicios de ajuste no incluidos",
          text: "Esta tarifa cobra aparte los servicios de ajuste del sistema, que varían cada mes y no están incluidos en el coste de esta propuesta.",
          tone: WARN_SOFT,
          edge: WARN,
        }
      : null,
  ].filter((note): note is Note => note !== null);
}

/** Cómo se ha hecho el estudio, en claro: de dónde sale cada número. */
function Method({ doc }: { doc: ProposalDocument }) {
  const sips = doc.supply.consumptionSource === "sips";
  const items = [
    {
      title: sips ? "Su consumo real" : "Su consumo, estimado",
      text: sips
        ? `${doc.supply.sipsMonths ?? 12} meses de lecturas de su contador en la distribuidora${doc.supply.distributor ? ` (${doc.supply.distributor})` : ""}. Nada estimado.`
        : `El consumo de su factura${doc.supply.estimate ? ` (${doc.supply.estimate.invoiceDays} días)` : ""} llevado a un año: es una estimación.`,
    },
    {
      title: "Precios del día",
      text: isGas(doc)
        ? `Las tarifas de gas de cada comercializadora para su peaje (${doc.supply.gas?.accessTariff ?? "RL"}) a ${longDate(doc.priceDate)}.`
        : `Las tarifas de cada comercializadora a ${longDate(doc.priceDate)}, con los peajes y cargos del BOE vigentes.`,
    },
    {
      title: "Todo incluido",
      text: isGas(doc)
        ? "Impuesto de hidrocarburos, IVA, alquiler del contador y servicios: lo mismo que verá en su factura."
        : "Impuesto eléctrico, IVA, alquiler del contador, bono social y servicios: lo mismo que verá en su factura.",
    },
  ];
  return (
    <View style={styles.section} wrap={false}>
      <SectionTitle
        title="Cómo hemos hecho este estudio"
        lead="Es una estimación de un año: lo que pague dependerá de su consumo real, y los precios pueden cambiar si la comercializadora los actualiza antes de contratar."
      />
      <View style={styles.steps}>
        {items.map((item) => (
          <View key={item.title} style={[styles.step, { borderWidth: 1, borderColor: LINE }]}>
            <Text style={[styles.bold, { marginBottom: 2 }]}>{item.title}</Text>
            <Text style={[styles.small, styles.muted]}>{item.text}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Qué pasa si dice que sí, y a quién llamar. */
function NextSteps({ doc, palette }: { doc: ProposalDocument; palette: Palette }) {
  const steps = [
    { title: "Nos dice que sí.", text: "Revisamos con usted la propuesta y resolvemos cualquier duda." },
    { title: "Firma el contrato.", text: "Solo hace falta su DNI o CIF y su cuenta bancaria." },
    { title: "Nosotros hacemos el resto.", text: `Sin cortes de ${energyWord(doc)}, sin obras y con el mismo contador.` },
  ];
  const advisor = doc.advisor && (doc.advisor.name || doc.advisor.email) ? doc.advisor : null;
  return (
    <View style={[styles.section, { flexDirection: "row", gap: 10, borderRadius: 8, backgroundColor: palette.soft, padding: 10 }]} wrap={false}>
      <View style={{ flex: 2 }}>
        <Text style={[styles.sectionTitle, { marginBottom: 5 }]}>Próximos pasos</Text>
        {steps.map((step, index) => (
          <View key={step.title} style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
            <View style={[styles.stepNumber, { backgroundColor: palette.brand, marginBottom: 0, marginRight: 7, width: 15, height: 15 }]}>
              <Text style={{ fontSize: 7.5, fontWeight: 600, color: palette.on }}>{index + 1}</Text>
            </View>
            <Text style={{ flex: 1 }}>
              <Text style={styles.bold}>{step.title}</Text> <Text style={styles.muted}>{step.text}</Text>
            </Text>
          </View>
        ))}
      </View>
      {advisor && (
        <View style={{ flex: 1, backgroundColor: "#ffffff", borderRadius: 8, borderWidth: 1, borderColor: palette.line, padding: 9, justifyContent: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: palette.brand, alignItems: "center", justifyContent: "center", marginRight: 8 }}>
              <Text style={{ fontWeight: 600, color: palette.on }}>{(advisor.name ?? advisor.email ?? "?").trim().charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.small, styles.muted]}>Su asesor</Text>
              <Text style={styles.bold}>{advisor.name ?? advisor.email}</Text>
            </View>
          </View>
          {advisor.name && advisor.email && <Text style={{ color: palette.ink, fontWeight: 600, marginTop: 6 }}>{advisor.email}</Text>}
        </View>
      )}
    </View>
  );
}

function PageHead({ title, lead }: { title: string; lead: string }) {
  return (
    <View>
      <Text style={styles.pageTitle}>{title}</Text>
      <Text style={styles.pageLead}>{lead}</Text>
    </View>
  );
}

export function ProposalPdf({ document: doc, branding }: { document: ProposalDocument; branding: ProposalBranding }) {
  const { supply, offer } = doc;
  const palette = brandPalette(branding.color);
  const colors = { P1: mix(palette.brand, "#000000", 0.6), P2: palette.brand, P3: tint(palette.brand, 0.4) };
  const alternatives = doc.alternatives ?? [];
  const annual = totalKwh(supply.annualKwh);
  const months = supply.readings?.length ? monthsFromReadings(supply.readings) : [];
  const place = supply.location ? [supply.location.municipality, supply.location.province].filter(Boolean).join(", ") : "";
  const gas = isGas(doc);
  const word = energyWord(doc);
  const meta = [
    doc.client.cups ? `CUPS ${doc.client.cups}` : null,
    gas ? `Gas natural · peaje ${supply.gas?.accessTariff ?? "RL"}` : "Tarifa 2.0TD",
    place || (TERRITORY[supply.territory] ?? supply.territory),
    gas ? null : `${kw(supply.contractedKw.P1)} contratados`,
  ].filter((text): text is string => Boolean(text));
  const page = (kicker: string, children: ReactNode) => (
    <Page size="A4" style={styles.page}>
      <Header branding={branding} palette={palette} generatedAt={doc.generatedAt} kicker={kicker} />
      {children}
      <Footer doc={doc} branding={branding} />
    </Page>
  );

  return (
    <Document title={`Estudio de ahorro - ${offer.comercializadoraName}`} author={branding.displayName} language="es">
      {page(
        alternatives.length ? `Comparativa de ofertas de ${word}` : `Estudio de ahorro en ${word}`,
        <>
          <Text style={styles.pageTitle}>{doc.client.name ? `Preparado para ${doc.client.name}` : `Estudio de su factura de ${word}`}</Text>
          <View style={styles.meta}>
            {meta.map((text) => (
              <Text key={text} style={styles.metaItem}>
                {text}
              </Text>
            ))}
          </View>
          <Hero doc={doc} palette={palette} />
          {alternatives.length ? (
            <>
              <Options doc={doc} palette={palette} />
              <PriceTable doc={doc} palette={palette} all />
            </>
          ) : (
            <>
              <Versus doc={doc} palette={palette} />
              <Ribbon doc={doc} palette={palette} />
              <Drivers doc={doc} />
            </>
          )}
          <Method doc={doc} />
        </>,
      )}
      {page(
        "Su consumo",
        <>
          <PageHead
            title="Su consumo, al detalle"
            lead={gas ? "Lo que dice su contador del último año: cuánto gas y en qué meses." : "Lo que dice su contador del último año: cuánto, cuándo y con qué potencia."}
          />
          <View style={styles.tiles}>
            <Tile label="Consumo anual" value={kwh(annual)} note={supply.consumptionSource === "sips" ? `${supply.sipsMonths ?? 12} meses reales (SIPS)` : "Estimado con su factura"} />
            {gas ? (
              <Tile label="Peaje de acceso" value={supply.gas?.accessTariff ?? "—"} note="Según su consumo anual" />
            ) : (
              <Tile label="Potencia contratada" value={kw(supply.contractedKw.P1)} note={supply.contractedKw.P1 === supply.contractedKw.P2 ? "Punta y valle" : `Valle ${kw(supply.contractedKw.P2)}`} />
            )}
            {supply.power && <Tile label="Máxima demanda" value={kw(supply.power.maxDemandKw)} note="La más alta del año" />}
          </View>
          {months.length >= 3 && (
            <>
              <MonthlyConsumption months={months} colors={colors} territory={supply.territory} gas={gas} />
              {/* Con una indexada, cómo se mueve su precio: el coste de cada mes a precio medio no lo enseñaba. */}
              {indexedMonthly(doc, months) ? (
                <IndexedPrices doc={doc} months={months} palette={palette} />
              ) : (
                <MonthlyBills months={months} doc={doc} palette={palette} />
              )}
            </>
          )}
          {!gas && <Periods doc={doc} palette={palette} colors={colors} />}
          {!gas && <PowerCheck doc={doc} palette={palette} />}
        </>,
      )}
      {page(
        alternatives.length ? "Detalle de la oferta recomendada" : "Detalle de la propuesta",
        <>
          <PageHead
            title={`${offer.comercializadoraName} · ${offer.productName}`}
            lead={alternatives.length ? "La oferta recomendada, precio a precio y concepto a concepto." : "Precio a precio y concepto a concepto, sin letra pequeña."}
          />
          <PriceTable doc={doc} palette={palette} />
          <CostTable doc={doc} palette={palette} />
          <Notes notes={proposalNotes(doc)} />
          <NextSteps doc={doc} palette={palette} />
        </>,
      )}
    </Document>
  );
}

/**
 * Inter va incrustada: con las fuentes estándar del PDF cada visor pone la
 * suya, y el € y las negritas salían mal. next.config la incluye en la función.
 */
let fontsReady = false;
function registerFonts() {
  if (fontsReady) return;
  const dir = path.join(process.cwd(), "src/comparador/pdf/fonts");
  Font.register({
    family: "Inter",
    fonts: [
      { src: path.join(dir, "Inter-Regular.woff"), fontWeight: 400 },
      { src: path.join(dir, "Inter-SemiBold.woff"), fontWeight: 600 },
    ],
  });
  // Sin guiones a final de línea: parten mal los nombres de tarifa.
  Font.registerHyphenationCallback((word) => [word]);
  fontsReady = true;
}

export async function renderProposalPdf(document: ProposalDocument, branding: ProposalBranding): Promise<Buffer> {
  registerFonts();
  return renderToBuffer(<ProposalPdf document={document} branding={branding} />);
}
