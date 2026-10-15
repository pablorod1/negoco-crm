import path from "node:path";
import { Document, Font, Image, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { CostBreakdown, TariffPrices } from "@/comparador/engine/types";
import type { ProposalDocument, ProposalOffer } from "@/comparador/study/proposals";

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

const euros = (value: number) =>
  `${value < 0 ? "−" : ""}${Math.abs(value).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: "always" })} €`;
/** Diferencia con signo: «−66,44 €» ahorra, «+3,10 €» cuesta más. */
const delta = (value: number) =>
  Math.abs(value) < 0.005 ? "=" : `${value < 0 ? "−" : "+"}${euros(Math.abs(value))}`;
/** Precio unitario con 4 a 6 decimales: 0,2149 en vez de 0,214900. */
const price = (value: number) =>
  value.toLocaleString("es-ES", { minimumFractionDigits: 4, maximumFractionDigits: 6 });
const kw = (value: number) => `${value.toLocaleString("es-ES", { maximumFractionDigits: 3 })} kW`;
const kwh = (value: number) => `${Math.round(value).toLocaleString("es-ES", { useGrouping: "always" })} kWh`;
const longDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Madrid",
  });

const INK = "#0f172a";
const TEXT = "#334155";
const MUTED = "#64748b";
const LINE = "#e2e8f0";
const SOFT = "#f8fafc";
const GOOD = "#047857";
const GOOD_SOFT = "#ecfdf5";
const BAD = "#b91c1c";
/** «Hoy»: siempre gris pizarra. «Propuesta»: siempre el color de la marca. */
const TODAY = "#64748b";
const TODAY_SOFT = "#f1f5f9";

/** El color de la marca mezclado con blanco: fondos suaves de la columna «Propuesta». */
function tint(hex: string, amount: number): string {
  const value = hex.replace("#", "");
  const channel = (index: number) => parseInt(value.slice(index, index + 2), 16);
  const mix = (index: number) => Math.round(channel(index) + (255 - channel(index)) * (1 - amount));
  return `#${[0, 2, 4].map((index) => mix(index).toString(16).padStart(2, "0")).join("")}`;
}

const styles = StyleSheet.create({
  page: { paddingTop: 26, paddingHorizontal: 36, paddingBottom: 46, fontSize: 9, fontFamily: "Inter", color: TEXT },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  logo: { height: 30, maxWidth: 170, objectFit: "contain", objectPositionX: 0 },
  brandName: { fontSize: 15, fontWeight: 600 },
  headerRight: { alignItems: "flex-end" },
  kicker: { fontSize: 7.5, fontWeight: 600, letterSpacing: 0.9, textTransform: "uppercase" },
  muted: { color: MUTED },
  small: { fontSize: 7.5 },
  bold: { fontWeight: 600, color: INK },
  title: { fontSize: 17, fontWeight: 600, color: INK, marginTop: 14 },
  subtitle: { color: MUTED, marginTop: 3 },

  hero: { marginTop: 12, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 18, flexDirection: "row", alignItems: "center" },
  heroLabel: { fontSize: 9, color: "#ffffff", opacity: 0.9 },
  heroValue: { fontSize: 30, fontWeight: 600, color: "#ffffff", marginTop: 1 },
  heroNote: { fontSize: 9.5, color: "#ffffff", marginTop: 2 },
  heroPill: { borderRadius: 14, paddingVertical: 5, paddingHorizontal: 10, backgroundColor: "#ffffff" },

  versus: { flexDirection: "row", marginTop: 10, alignItems: "stretch" },
  side: { flex: 1, borderRadius: 8, borderWidth: 1, overflow: "hidden" },
  sideBand: { paddingVertical: 4, paddingHorizontal: 10 },
  sideBandText: { fontSize: 7.5, fontWeight: 600, letterSpacing: 0.9, textTransform: "uppercase", color: "#ffffff" },
  sideBody: { paddingVertical: 8, paddingHorizontal: 10 },
  sideName: { fontSize: 11, fontWeight: 600, color: INK },
  sideAmount: { fontSize: 18, fontWeight: 600, marginTop: 6 },
  arrow: { width: 34, alignItems: "center", justifyContent: "center" },

  chips: { flexDirection: "row", flexWrap: "wrap", marginTop: 5 },
  chip: { fontSize: 7.5, borderRadius: 9, paddingVertical: 2, paddingHorizontal: 7, marginRight: 4, marginBottom: 3 },

  columns: { flexDirection: "row", marginTop: 12, gap: 14 },
  column: { flex: 1 },
  sectionTitle: { fontSize: 10.5, fontWeight: 600, color: INK, marginBottom: 5 },
  section: { marginTop: 12 },
  headRow: { flexDirection: "row" },
  headCell: { fontSize: 7.5, fontWeight: 600, paddingVertical: 4 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: LINE },
  cellLabel: { flex: 2.1, paddingLeft: 5, paddingVertical: 3 },
  cell: { flex: 1, textAlign: "right", paddingRight: 6, paddingVertical: 3 },
  totalRow: { flexDirection: "row", marginTop: 3, borderRadius: 5, overflow: "hidden" },

  facts: { flexDirection: "row", gap: 8 },
  fact: { flex: 1, borderWidth: 1, borderColor: LINE, borderRadius: 6, padding: 8 },
  factValue: { fontSize: 11, fontWeight: 600, color: INK, marginTop: 2 },
  split: { flexDirection: "row", height: 6, borderRadius: 3, overflow: "hidden", marginTop: 6 },
  legend: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },

  options: { flexDirection: "row", gap: 8, marginTop: 12 },
  option: { flex: 1, borderRadius: 8, borderWidth: 1, overflow: "hidden" },
  optionRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, borderTopWidth: 1, borderTopColor: LINE },

  note: { marginTop: 8, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 9, borderLeftWidth: 3 },
  noteTitle: { fontWeight: 600, color: INK, marginBottom: 2 },

  footer: {
    position: "absolute",
    left: 36,
    right: 36,
    bottom: 20,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: LINE,
    fontSize: 6.8,
    color: MUTED,
  },
});

interface Palette {
  brand: string;
  brandSoft: string;
  brandLine: string;
}

/** Cabeceras de las columnas «Hoy» y «Propuesta», cada una con su color. */
function HeadRow({ withToday, withDifference, palette, offerLabel }: { withToday: boolean; withDifference: boolean; palette: Palette; offerLabel: string }) {
  return (
    <View style={styles.headRow}>
      <Text style={[styles.cellLabel, styles.headCell, { color: MUTED }]}>Concepto</Text>
      {withToday && <Text style={[styles.cell, styles.headCell, { color: TODAY, backgroundColor: TODAY_SOFT }]}>Hoy</Text>}
      <Text style={[styles.cell, styles.headCell, { color: palette.brand, backgroundColor: palette.brandSoft }]}>{offerLabel}</Text>
      {withDifference && <Text style={[styles.cell, styles.headCell, { color: MUTED }]}>Diferencia</Text>}
    </View>
  );
}

/** Una fila: la columna «Hoy» en gris, la de la propuesta con fondo de la marca y la diferencia en verde o rojo. */
function Row({
  label,
  today,
  offer,
  difference,
  withToday,
  palette,
}: {
  label: string;
  today?: string;
  offer: string;
  difference?: { text: string; good: boolean | null };
  withToday: boolean;
  palette: Palette;
}) {
  return (
    <View style={styles.row} wrap={false}>
      <Text style={styles.cellLabel}>{label}</Text>
      {withToday && <Text style={[styles.cell, { color: TODAY, backgroundColor: TODAY_SOFT }]}>{today ?? "—"}</Text>}
      <Text style={[styles.cell, styles.bold, { backgroundColor: palette.brandSoft }]}>{offer}</Text>
      {difference !== undefined && (
        <Text style={[styles.cell, { fontWeight: 600, color: difference.good === null ? MUTED : difference.good ? GOOD : BAD }]}>
          {difference.text}
        </Text>
      )}
    </View>
  );
}

function TotalRow({ today, offer, withToday, palette }: { today: number | null; offer: number; withToday: boolean; palette: Palette }) {
  const difference = today === null ? null : offer - today;
  return (
    <View style={styles.totalRow} wrap={false}>
      <Text style={[styles.cellLabel, styles.bold, { backgroundColor: SOFT, paddingVertical: 5 }]}>Total al año, impuestos incluidos</Text>
      {withToday && (
        <Text style={[styles.cell, { fontWeight: 600, color: "#ffffff", backgroundColor: TODAY, paddingVertical: 5 }]}>{today === null ? "—" : euros(today)}</Text>
      )}
      <Text style={[styles.cell, { fontWeight: 600, color: "#ffffff", backgroundColor: palette.brand, paddingVertical: 5 }]}>{euros(offer)}</Text>
      {difference !== null && (
        <Text
          style={[
            styles.cell,
            { fontWeight: 600, paddingVertical: 5, color: difference < 0 ? GOOD : difference > 0 ? BAD : MUTED, backgroundColor: difference < 0 ? GOOD_SOFT : SOFT },
          ]}
        >
          {delta(difference)}
        </Text>
      )}
    </View>
  );
}

function priceRows(current: TariffPrices | null, offer: TariffPrices) {
  const show = (value: number | undefined) => (value === undefined ? "—" : price(value));
  return [
    { label: "Potencia P1 punta · €/kW día", today: show(current?.power.P1), offer: price(offer.power.P1) },
    { label: "Potencia P2 valle · €/kW día", today: show(current?.power.P2), offer: price(offer.power.P2) },
    { label: "Energía P1 punta · €/kWh", today: show(current?.energy.P1), offer: price(offer.energy.P1) },
    { label: "Energía P2 llano · €/kWh", today: show(current?.energy.P2), offer: price(offer.energy.P2) },
    { label: "Energía P3 valle · €/kWh", today: show(current?.energy.P3), offer: price(offer.energy.P3) },
  ];
}

function costRows(current: CostBreakdown | null, offer: CostBreakdown) {
  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
  const lines: { label: string; pick: (cost: CostBreakdown) => number }[] = [
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
    .map(({ label, pick }) => {
      const difference = current ? pick(offer) - pick(current) : null;
      return {
        label,
        today: current ? euros(pick(current)) : undefined,
        offer: euros(pick(offer)),
        difference:
          difference === null
            ? undefined
            : { text: delta(difference), good: Math.abs(difference) < 0.005 ? null : difference < 0 },
      };
    });
}

const offerChips = (offer: ProposalOffer) =>
  [
    offer.pricing === "indexed" ? "Precio indexado" : null,
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
          <Text style={[styles.brandName, { color: palette.brand }]}>{branding.displayName}</Text>
        )}
        <View style={styles.headerRight}>
          <Text style={[styles.kicker, { color: palette.brand }]}>{kicker}</Text>
          <Text style={[styles.muted, { marginTop: 2 }]}>{longDate(generatedAt)}</Text>
        </View>
      </View>
      <View style={{ height: 3, borderRadius: 2, backgroundColor: palette.brand, marginTop: 9 }} />
    </View>
  );
}

function Hero({ savings, total, current, palette }: { savings: number | null; total: number; current: number | null; palette: Palette }) {
  const saves = savings !== null && savings > 0;
  const percent = saves && current && current > 0 ? Math.round((savings / current) * 100) : null;
  return (
    <View style={[styles.hero, { backgroundColor: saves ? GOOD : palette.brand }]} wrap={false}>
      <View style={{ flex: 1 }}>
        <Text style={styles.heroLabel}>{saves ? "Con esta propuesta ahorra" : "Coste estimado con la propuesta"}</Text>
        <Text style={styles.heroValue}>
          {euros(saves ? savings : total)}
          <Text style={{ fontSize: 13 }}> al año</Text>
        </Text>
        <Text style={styles.heroNote}>Unos {euros((saves ? savings : total) / 12)} al mes, impuestos incluidos</Text>
      </View>
      {percent !== null && (
        <View style={styles.heroPill}>
          <Text style={{ fontSize: 16, fontWeight: 600, color: GOOD }}>−{percent} %</Text>
          <Text style={[styles.small, { color: GOOD, textAlign: "center" }]}>que hoy</Text>
        </View>
      )}
    </View>
  );
}

/** Hoy frente a la propuesta: dos tarjetas con su color y lo que cuesta cada una al año y al mes. */
function Versus({
  current,
  currentLabel,
  offer,
  palette,
}: {
  current: { name: string; detail: string; total: number } | null;
  currentLabel: string;
  offer: ProposalOffer;
  palette: Palette;
}) {
  return (
    <View style={styles.versus} wrap={false}>
      {current && (
        <>
          <View style={[styles.side, { borderColor: TODAY_SOFT }]}>
            <View style={[styles.sideBand, { backgroundColor: TODAY }]}>
              <Text style={styles.sideBandText}>{currentLabel}</Text>
            </View>
            <View style={[styles.sideBody, { backgroundColor: TODAY_SOFT }]}>
              <Text style={styles.sideName}>{current.name}</Text>
              <Text style={[styles.small, styles.muted, { marginTop: 1 }]}>{current.detail}</Text>
              <Text style={[styles.sideAmount, { color: TODAY }]}>{euros(current.total)}</Text>
              <Text style={[styles.small, styles.muted]}>al año · {euros(current.total / 12)} al mes</Text>
            </View>
          </View>
          <View style={styles.arrow}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: SOFT, borderWidth: 1, borderColor: LINE, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 7, fontWeight: 600, color: MUTED }}>VS</Text>
            </View>
          </View>
        </>
      )}
      <View style={[styles.side, { borderColor: palette.brandLine }]}>
        <View style={[styles.sideBand, { backgroundColor: palette.brand }]}>
          <Text style={styles.sideBandText}>Le proponemos</Text>
        </View>
        <View style={[styles.sideBody, { backgroundColor: palette.brandSoft }]}>
          <Text style={styles.sideName}>{offer.comercializadoraName}</Text>
          <Text style={[styles.small, styles.muted, { marginTop: 1 }]}>{offer.productName}</Text>
          <Text style={[styles.sideAmount, { color: palette.brand }]}>{euros(offer.cost.total)}</Text>
          <Text style={[styles.small, styles.muted]}>al año · {euros(offer.cost.total / 12)} al mes</Text>
          {offerChips(offer).length > 0 && (
            <View style={styles.chips}>
              {offerChips(offer).map((text) => (
                <Text key={text} style={[styles.chip, { backgroundColor: "#ffffff", color: palette.brand }]}>
                  {text}
                </Text>
              ))}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

/** Hasta tres ofertas lado a lado, frente a lo que paga hoy. La primera es la recomendada. */
function Options({ doc, palette }: { doc: ProposalDocument; palette: Palette }) {
  const options = [{ ...doc.offer, savings: doc.savings }, ...(doc.alternatives ?? [])];
  const current = doc.current;
  const line = (label: string, value: string, color?: string) => (
    <View style={styles.optionRow}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={[styles.bold, color ? { color } : {}]}>{value}</Text>
    </View>
  );
  return (
    <View style={styles.options} wrap={false}>
      {current && (
        <View style={[styles.option, { borderColor: TODAY_SOFT }]}>
          <View style={[styles.sideBand, { backgroundColor: TODAY }]}>
            <Text style={styles.sideBandText}>Hoy</Text>
          </View>
          <View style={[styles.sideBody, { backgroundColor: TODAY_SOFT }]}>
            <Text style={styles.sideName}>{current.supplierName ?? "Su tarifa actual"}</Text>
            <Text style={[styles.sideAmount, { color: TODAY }]}>{euros(current.cost.total)}</Text>
            <Text style={[styles.small, styles.muted, { marginBottom: 6 }]}>al año</Text>
            {line("Al mes", euros(current.cost.total / 12))}
          </View>
        </View>
      )}
      {options.map((option, index) => {
        const saves = option.savings !== null && option.savings > 0;
        const recommended = index === 0;
        return (
          <View key={`${option.comercializadoraName}-${option.productName}`} style={[styles.option, { borderColor: recommended ? palette.brand : palette.brandLine, borderWidth: recommended ? 2 : 1 }]}>
            <View style={[styles.sideBand, { backgroundColor: recommended ? palette.brand : tint(palette.brand, 0.55) }]}>
              <Text style={styles.sideBandText}>{recommended ? "Recomendada" : `Opción ${index + 1}`}</Text>
            </View>
            <View style={[styles.sideBody, { backgroundColor: recommended ? palette.brandSoft : "#ffffff" }]}>
              <Text style={styles.sideName}>{option.comercializadoraName}</Text>
              <Text style={[styles.small, styles.muted]}>{option.productName}</Text>
              <Text style={[styles.sideAmount, { color: palette.brand }]}>{euros(option.cost.total)}</Text>
              <Text style={[styles.small, styles.muted, { marginBottom: 6 }]}>al año</Text>
              {line("Al mes", euros(option.cost.total / 12))}
              {option.savings !== null &&
                line(saves ? "Ahorra" : "Pagaría más", saves ? euros(option.savings) : `+${euros(-option.savings)}`, saves ? GOOD : BAD)}
              {option.savings !== null && current && current.cost.total > 0 && saves
                ? line("Menos que hoy", `${Math.round((option.savings / current.cost.total) * 100)} %`, GOOD)
                : null}
              {option.termMonths ? line("Contrato", `${option.termMonths} meses`) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Coste de un año de cada opción en barras, con los mismos colores que las tarjetas. */
function OptionBars({ doc, palette }: { doc: ProposalDocument; palette: Palette }) {
  const options = [{ ...doc.offer, savings: doc.savings }, ...(doc.alternatives ?? [])];
  const bars = [
    ...(doc.current ? [{ label: `Hoy · ${doc.current.supplierName ?? "su tarifa"}`, total: doc.current.cost.total, color: TODAY }] : []),
    ...options.map((option, index) => ({
      label: `${index === 0 ? "Recomendada" : `Opción ${index + 1}`} · ${option.comercializadoraName}`,
      total: option.cost.total,
      color: index === 0 ? palette.brand : tint(palette.brand, 0.55),
    })),
  ];
  const max = Math.max(...bars.map(({ total }) => total)) || 1;
  return (
    <View style={styles.section} wrap={false}>
      <Text style={styles.sectionTitle}>Coste de un año, impuestos incluidos</Text>
      {bars.map((bar) => (
        <View key={bar.label} style={{ flexDirection: "row", alignItems: "center", marginBottom: 5 }}>
          <Text style={{ width: 170 }}>{bar.label}</Text>
          <View style={{ flex: 1, height: 12, backgroundColor: SOFT, borderRadius: 3 }}>
            <View style={{ width: `${Math.max(4, (bar.total / max) * 100)}%`, height: 12, backgroundColor: bar.color, borderRadius: 3 }} />
          </View>
          <Text style={[styles.bold, { width: 70, textAlign: "right" }]}>{euros(bar.total)}</Text>
        </View>
      ))}
    </View>
  );
}

/** Los precios de todas las opciones frente a los de hoy. */
function OptionPrices({ doc, palette }: { doc: ProposalDocument; palette: Palette }) {
  const options = [doc.offer, ...(doc.alternatives ?? [])];
  const today = doc.current?.prices ?? null;
  const rows: { label: string; pick: (prices: TariffPrices) => number }[] = [
    { label: "Potencia P1 punta · €/kW día", pick: (prices) => prices.power.P1 },
    { label: "Potencia P2 valle · €/kW día", pick: (prices) => prices.power.P2 },
    { label: "Energía P1 punta · €/kWh", pick: (prices) => prices.energy.P1 },
    { label: "Energía P2 llano · €/kWh", pick: (prices) => prices.energy.P2 },
    { label: "Energía P3 valle · €/kWh", pick: (prices) => prices.energy.P3 },
  ];
  return (
    <View style={styles.section} wrap={false}>
      <Text style={styles.sectionTitle}>Precios de cada oferta</Text>
      <View style={styles.headRow}>
        <Text style={[styles.cellLabel, styles.headCell, { color: MUTED }]}>Concepto</Text>
        {today && <Text style={[styles.cell, styles.headCell, { color: TODAY, backgroundColor: TODAY_SOFT }]}>Hoy</Text>}
        {options.map((option, index) => (
          <Text
            key={`${option.comercializadoraName}-${index}`}
            style={[styles.cell, styles.headCell, { color: palette.brand, backgroundColor: index === 0 ? palette.brandSoft : undefined }]}
          >
            {option.comercializadoraName}
          </Text>
        ))}
      </View>
      {rows.map((row) => (
        <View key={row.label} style={styles.row}>
          <Text style={styles.cellLabel}>{row.label}</Text>
          {today && <Text style={[styles.cell, { color: TODAY, backgroundColor: TODAY_SOFT }]}>{price(row.pick(today))}</Text>}
          {options.map((option, index) => (
            <Text key={`${option.comercializadoraName}-${index}`} style={[styles.cell, styles.bold, { backgroundColor: index === 0 ? palette.brandSoft : undefined }]}>
              {price(row.pick(option.prices))}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function Notes({ notes }: { notes: { title: string; text: string; tone: string; edge: string }[] }) {
  return (
    <>
      {notes.map((note) => (
        <View key={note.title} style={[styles.note, { backgroundColor: note.tone, borderLeftColor: note.edge }]} wrap={false}>
          <Text style={styles.noteTitle}>{note.title}</Text>
          <Text>{note.text}</Text>
        </View>
      ))}
    </>
  );
}

/** «mayo de 2025». */
const monthName = (month: string) =>
  new Date(`${month}-15T12:00:00Z`).toLocaleDateString("es-ES", { month: "long", year: "numeric", timeZone: "Europe/Madrid" });

/**
 * Aviso de las ofertas indexadas: su energía es la que cobró la
 * comercializadora cada mes del último año, no un precio fijo.
 */
function indexedNote(
  offer: ProposalDocument["offer"],
  alternatives: readonly ProposalDocument["offer"][],
  currentIndexed: boolean,
) {
  const indexed = [offer, ...alternatives].filter(({ pricing }) => pricing === "indexed");
  if (indexed.length === 0) return null;
  const period = indexed[0].indexHistory
    ? `, de ${monthName(indexed[0].indexHistory.from)} a ${monthName(indexed[0].indexHistory.to)}`
    : "";
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
      tone: "#eef2ff",
      edge: "#6366f1",
    };
  }
  return {
    title: which,
    text: `Su energía es la que cobró la comercializadora cada mes${period}, con su consumo de esos meses (en la tabla, la media del año). Su precio sube y baja con el mercado: los próximos meses pueden ser distintos.`,
    tone: "#eef2ff",
    edge: "#6366f1",
  };
}

function Footer({ doc, branding }: { doc: ProposalDocument; branding: ProposalBranding }) {
  return (
    <Text style={styles.footer} fixed>
      Estimación de un año con su consumo y su potencia, los peajes, cargos e impuestos vigentes y los precios de las
      comercializadoras a {longDate(doc.priceDate)}. Lo que pague dependerá de su consumo real. Los precios pueden cambiar si
      la comercializadora los actualiza antes de la contratación. Propuesta preparada por {branding.displayName}.
    </Text>
  );
}

export function ProposalPdf({ document: doc, branding }: { document: ProposalDocument; branding: ProposalBranding }) {
  const { supply, offer, current, savings } = doc;
  const palette: Palette = { brand: branding.color, brandSoft: tint(branding.color, 0.08), brandLine: tint(branding.color, 0.3) };
  const annual = supply.annualKwh.P1 + supply.annualKwh.P2 + supply.annualKwh.P3;
  const share = (value: number) => (annual > 0 ? Math.round((value / annual) * 100) : 0);
  const withToday = current !== null;
  const alternatives = doc.alternatives ?? [];
  const power = supply.power;
  const notes = [
    power && power.status === "exceeded"
      ? {
          title: "Le recomendamos subir la potencia",
          text: `Su máxima demanda de los últimos 12 meses fue de ${kw(power.maxDemandKw)}, por encima de la potencia contratada. Subirla a ${kw(power.suggestedKw)} evita que salte el limitador.`,
          tone: "#fffbeb",
          edge: "#f59e0b",
        }
      : power && power.status === "oversized"
        ? {
            title: "Podría pagar menos de potencia",
            text: `Su máxima demanda de los últimos 12 meses fue de ${kw(power.maxDemandKw)}. Si baja la potencia a ${kw(power.suggestedKw)}, el término fijo será menor.`,
            tone: GOOD_SOFT,
            edge: GOOD,
          }
        : null,
    // Si la propuesta también es indexada, va todo en el aviso de la propuesta.
    current?.pricing === "indexed" && offer.pricing !== "indexed"
      ? {
          title: "Su tarifa de hoy es indexada",
          text: "Lo que paga hoy se ha estimado con el precio del mercado eléctrico (OMIE) de sus últimos 12 meses de consumo, más lo que su factura cobra por encima del mercado. Con una tarifa indexada su precio sube y baja con el mercado.",
          tone: "#eef2ff",
          edge: "#6366f1",
        }
      : null,
    current?.pricing === "flat"
      ? {
          title: "Su tarifa de hoy es una tarifa plana",
          text: "Hoy paga una cuota fija al mes. Si supera el consumo anual pactado, su comercializadora le repercutirá el coste del exceso al final del contrato.",
          tone: "#fffbeb",
          edge: "#f59e0b",
        }
      : null,
    indexedNote(offer, alternatives, current?.pricing === "indexed"),
    offer.ancillarySimulated && (offer.cost.ancillary ?? 0) > 0
      ? {
          title: "Servicios de ajuste estimados",
          text: `Esta tarifa cobra aparte los servicios de ajuste del sistema, que varían cada mes. El coste incluye una estimación de ${euros(offer.cost.ancillary ?? 0)} al año${annual > 0 ? ` (${(Math.round(((offer.cost.ancillary ?? 0) / annual) * 1000 * 100) / 100).toLocaleString("es-ES")} €/MWh)` : ""}.`,
          tone: SOFT,
          edge: TODAY,
        }
      : null,
    offer.needsAncillary
      ? {
          title: "Servicios de ajuste no incluidos",
          text: "Esta tarifa cobra aparte los servicios de ajuste del sistema, que varían cada mes y no están incluidos en el coste de esta propuesta.",
          tone: "#fffbeb",
          edge: "#f59e0b",
        }
      : null,
  ].filter((note): note is { title: string; text: string; tone: string; edge: string } => note !== null);
  const consumptionSource =
    supply.consumptionSource === "sips"
      ? `Consumo real de ${supply.sipsMonths ?? 12} meses (distribuidora)`
      : "Consumo de su factura llevado a un año";
  const periods = [
    { label: "Punta", value: supply.annualKwh.P1, opacity: 1 },
    { label: "Llano", value: supply.annualKwh.P2, opacity: 0.6 },
    { label: "Valle", value: supply.annualKwh.P3, opacity: 0.3 },
  ];
  const title = doc.client.name ? `Preparada para ${doc.client.name}` : "Estudio de su factura de luz";
  const subtitle = [doc.client.cups ? `CUPS ${doc.client.cups}` : null, "Tarifa 2.0TD", TERRITORY[supply.territory] ?? supply.territory]
    .filter(Boolean)
    .join(" · ");
  const pricingLabel = current?.pricing === "indexed" ? "Tarifa indexada" : current?.pricing === "flat" ? "Tarifa plana" : "Tarifa actual";

  const detail = (
    <>
      <View style={styles.columns}>
        <View style={styles.column} wrap={false}>
          <Text style={styles.sectionTitle}>Su suministro</Text>
          <View style={styles.facts}>
            <View style={styles.fact}>
              <Text style={styles.muted}>Potencia contratada</Text>
              <Text style={styles.factValue}>
                {kw(supply.contractedKw.P1)} / {kw(supply.contractedKw.P2)}
              </Text>
              <Text style={[styles.muted, styles.small]}>Punta / valle</Text>
            </View>
            <View style={styles.fact}>
              <Text style={styles.muted}>Consumo anual</Text>
              <Text style={styles.factValue}>{kwh(annual)}</Text>
              <Text style={[styles.muted, styles.small]}>{consumptionSource}</Text>
            </View>
          </View>
          {annual > 0 && (
            <View style={{ marginTop: 8 }}>
              <View style={styles.split}>
                {periods.map((period) => (
                  <View key={period.label} style={{ width: `${share(period.value)}%`, backgroundColor: palette.brand, opacity: period.opacity }} />
                ))}
              </View>
              <View style={styles.legend}>
                {periods.map((period) => (
                  <View key={period.label} style={{ flex: 1 }}>
                    <Text style={styles.small}>
                      {period.label} · {share(period.value)} %
                    </Text>
                    <Text style={[styles.small, styles.muted]}>{kwh(period.value)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        <View style={styles.column} wrap={false}>
          <Text style={styles.sectionTitle}>Precios</Text>
          <HeadRow withToday={withToday} withDifference={false} palette={palette} offerLabel="Propuesta" />
          {priceRows(current?.prices ?? null, offer.prices).map((row) => (
            <Row key={row.label} {...row} withToday={withToday} palette={palette} />
          ))}
        </View>
      </View>

      <View style={styles.section} wrap={false}>
        <Text style={styles.sectionTitle}>Coste de un año, concepto a concepto</Text>
        <HeadRow withToday={withToday} withDifference={withToday} palette={palette} offerLabel="Propuesta" />
        {costRows(current?.cost ?? null, offer.cost).map((row) => (
          <Row key={row.label} {...row} withToday={withToday} palette={palette} />
        ))}
        <TotalRow today={current?.cost.total ?? null} offer={offer.cost.total} withToday={withToday} palette={palette} />
      </View>

      <Notes notes={notes} />
    </>
  );

  return (
    <Document title={`Propuesta de ahorro - ${offer.comercializadoraName}`} author={branding.displayName} language="es">
      <Page size="A4" style={styles.page}>
        <Header branding={branding} palette={palette} generatedAt={doc.generatedAt} kicker={alternatives.length ? "Comparativa de ofertas de luz" : "Propuesta de ahorro en luz"} />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <Hero savings={savings} total={offer.cost.total} current={current?.cost.total ?? null} palette={palette} />
        {alternatives.length ? (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 14 }]}>Hemos comparado {alternatives.length + 1} ofertas para usted</Text>
            <Options doc={doc} palette={palette} />
            <OptionBars doc={doc} palette={palette} />
            <OptionPrices doc={doc} palette={palette} />
            <Text style={[styles.small, styles.muted, { marginTop: 10 }]}>
              En la página siguiente, el detalle de la oferta recomendada concepto a concepto.
            </Text>
          </>
        ) : (
          <>
            <Versus
              current={current ? { name: current.supplierName ?? "Su comercializadora", detail: pricingLabel, total: current.cost.total } : null}
              currentLabel="Hoy paga"
              offer={offer}
              palette={palette}
            />
            {detail}
          </>
        )}
        <Footer doc={doc} branding={branding} />
      </Page>
      {alternatives.length > 0 && (
        <Page size="A4" style={styles.page}>
          <Header branding={branding} palette={palette} generatedAt={doc.generatedAt} kicker="Detalle de la oferta recomendada" />
          <Versus
            current={current ? { name: current.supplierName ?? "Su comercializadora", detail: pricingLabel, total: current.cost.total } : null}
            currentLabel="Hoy paga"
            offer={offer}
            palette={palette}
          />
          {detail}
          <Footer doc={doc} branding={branding} />
        </Page>
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
