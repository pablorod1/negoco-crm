import path from "node:path";
import { Document, Font, Image, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { CostBreakdown, TariffPrices } from "@/comparador/engine/types";
import type { ProposalDocument } from "@/comparador/study/proposals";

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

const INK = "#111827";
const TEXT = "#374151";
const MUTED = "#6b7280";
const LINE = "#e5e7eb";
const SOFT = "#f9fafb";
const GOOD = "#047857";
const BAD = "#b91c1c";
const TRACK = "#d1d5db";

const styles = StyleSheet.create({
  page: { paddingTop: 28, paddingHorizontal: 40, paddingBottom: 48, fontSize: 9, fontFamily: "Inter", color: TEXT },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 10,
    borderBottomWidth: 2,
  },
  logo: { height: 30, maxWidth: 170, objectFit: "contain", objectPositionX: 0 },
  brandName: { fontSize: 15, fontWeight: 600 },
  headerRight: { alignItems: "flex-end" },
  kicker: { fontSize: 8, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase" },
  muted: { color: MUTED },
  small: { fontSize: 8 },
  bold: { fontWeight: 600, color: INK },
  title: { fontSize: 16, fontWeight: 600, color: INK, marginTop: 12 },
  subtitle: { color: MUTED, marginTop: 3 },

  hero: { flexDirection: "row", marginTop: 10, borderRadius: 8, overflow: "hidden" },
  heroMain: { flex: 1, paddingVertical: 12, paddingHorizontal: 16, justifyContent: "center" },
  heroLabel: { fontSize: 9, color: "#ffffff", opacity: 0.85 },
  heroValue: { fontSize: 26, fontWeight: 600, color: "#ffffff", marginTop: 2 },
  heroNote: { fontSize: 9.5, color: "#ffffff", marginTop: 4 },
  heroSide: { flex: 1.15, paddingVertical: 10, paddingHorizontal: 16, backgroundColor: SOFT, justifyContent: "center" },
  barBlock: { marginBottom: 8 },
  barHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  barTrack: { height: 7, borderRadius: 4, backgroundColor: "#eef0f3" },
  bar: { height: 7, borderRadius: 4 },

  offerCard: {
    flexDirection: "row",
    marginTop: 10,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 8,
    borderLeftWidth: 4,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  offerName: { fontSize: 13, fontWeight: 600, color: INK },
  chips: { flexDirection: "row", flexWrap: "wrap", marginTop: 5 },
  chip: {
    fontSize: 8,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 9,
    paddingVertical: 2,
    paddingHorizontal: 7,
    marginRight: 4,
    marginBottom: 3,
    color: TEXT,
  },

  columns: { flexDirection: "row", marginTop: 12, gap: 16 },
  column: { flex: 1 },
  sectionTitle: { fontSize: 10.5, fontWeight: 600, color: INK, marginBottom: 4 },
  section: { marginTop: 12 },
  headRow: { flexDirection: "row", paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: INK },
  row: { flexDirection: "row", paddingVertical: 2.5, borderBottomWidth: 1, borderBottomColor: LINE },
  totalRow: { flexDirection: "row", paddingVertical: 4, marginTop: 2, borderRadius: 4, backgroundColor: SOFT },
  cellLabel: { flex: 2.2, paddingLeft: 4 },
  cell: { flex: 1, textAlign: "right", paddingRight: 4 },
  headCell: { fontSize: 8, fontWeight: 600, color: MUTED },

  facts: { flexDirection: "row", gap: 8 },
  fact: { flex: 1, borderWidth: 1, borderColor: LINE, borderRadius: 6, padding: 8 },
  factValue: { fontSize: 11, fontWeight: 600, color: INK, marginTop: 2 },
  split: { flexDirection: "row", height: 6, borderRadius: 3, overflow: "hidden", marginTop: 6 },
  legend: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },

  note: { flexDirection: "row", marginTop: 8, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 8 },
  noteTitle: { fontWeight: 600, color: INK, marginBottom: 2 },

  steps: { flexDirection: "row", gap: 8 },
  step: { flex: 1, flexDirection: "row" },
  stepNumber: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  stepDigit: { color: "#ffffff", fontSize: 7.5, fontWeight: 600 },
  footer: {
    position: "absolute",
    left: 40,
    right: 40,
    bottom: 22,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: LINE,
    fontSize: 7,
    color: MUTED,
  },
});

/** Una fila de tabla con la columna «Hoy» y la diferencia solo si se sabe lo que paga hoy. */
function Row({
  label,
  today,
  offer,
  difference,
  withToday,
  total,
}: {
  label: string;
  today?: string;
  offer: string;
  difference?: { text: string; good: boolean | null };
  withToday: boolean;
  total?: boolean;
}) {
  const strong = total ? styles.bold : {};
  return (
    <View style={total ? styles.totalRow : styles.row} wrap={false}>
      <Text style={[styles.cellLabel, strong]}>{label}</Text>
      {withToday && <Text style={[styles.cell, strong]}>{today ?? "—"}</Text>}
      <Text style={[styles.cell, strong]}>{offer}</Text>
      {difference !== undefined && (
        <Text
          style={[
            styles.cell,
            strong,
            { color: difference.good === null ? MUTED : difference.good ? GOOD : BAD },
          ]}
        >
          {difference.text}
        </Text>
      )}
    </View>
  );
}

function HeadRow({ withToday, withDifference }: { withToday: boolean; withDifference: boolean }) {
  return (
    <View style={styles.headRow}>
      <Text style={[styles.cellLabel, styles.headCell]}>Concepto</Text>
      {withToday && <Text style={[styles.cell, styles.headCell]}>Hoy</Text>}
      <Text style={[styles.cell, styles.headCell]}>Propuesta</Text>
      {withDifference && <Text style={[styles.cell, styles.headCell]}>Diferencia</Text>}
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
    { label: "Término de potencia", pick: (cost) => cost.power.total },
    { label: "Término de energía", pick: (cost) => cost.energy.total },
    { label: "Descuentos", pick: (cost) => sum(cost.energyDiscounts) },
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

/** Barra de coste anual: la más cara llena la pista. */
function CostBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const width = `${Math.max(4, Math.min(100, (value / max) * 100))}%`;
  return (
    <View style={styles.barBlock}>
      <View style={styles.barHead}>
        <Text>{label}</Text>
        <Text style={styles.bold}>{euros(value)}/año</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.bar, { width, backgroundColor: color }]} />
      </View>
    </View>
  );
}

export function ProposalPdf({ document: doc, branding }: { document: ProposalDocument; branding: ProposalBranding }) {
  const { supply, offer, current, savings } = doc;
  const color = branding.color;
  const annual = supply.annualKwh.P1 + supply.annualKwh.P2 + supply.annualKwh.P3;
  const share = (value: number) => (annual > 0 ? Math.round((value / annual) * 100) : 0);
  const saves = savings !== null && savings > 0;
  const percent = saves && current && current.cost.total > 0 ? Math.round((savings / current.cost.total) * 100) : null;
  const withToday = current !== null;
  const chips = [
    offer.termMonths ? `Contrato de ${offer.termMonths} meses` : null,
    offer.powerMode === "regulated" ? "Potencia a precio regulado (BOE)" : null,
    ...offer.discounts,
  ].filter((text): text is string => Boolean(text));
  const power = supply.power;
  const powerNote =
    power && power.status === "exceeded"
      ? {
          title: "Le recomendamos subir la potencia",
          text: `Su máxima demanda de los últimos 12 meses fue de ${kw(power.maxDemandKw)}, por encima de la potencia contratada. Subirla a ${kw(power.suggestedKw)} evita que salte el limitador.`,
          tone: "#fef3c7",
        }
      : power && power.status === "oversized"
        ? {
            title: "Podría pagar menos de potencia",
            text: `Su máxima demanda de los últimos 12 meses fue de ${kw(power.maxDemandKw)}. Si baja la potencia a ${kw(power.suggestedKw)}, el término fijo será menor.`,
            tone: "#ecfdf5",
          }
        : null;
  const consumptionSource =
    supply.consumptionSource === "sips"
      ? `Consumo real de ${supply.sipsMonths ?? 12} meses (distribuidora)`
      : "Consumo de su factura llevado a un año";
  const periods = [
    { label: "Punta", value: supply.annualKwh.P1, opacity: 1 },
    { label: "Llano", value: supply.annualKwh.P2, opacity: 0.6 },
    { label: "Valle", value: supply.annualKwh.P3, opacity: 0.3 },
  ];
  const costMax = Math.max(offer.cost.total, current?.cost.total ?? 0) || 1;

  return (
    <Document title={`Propuesta ${doc.number} - ${offer.comercializadoraName}`} author={branding.displayName} language="es">
      <Page size="A4" style={styles.page}>
        <View style={[styles.header, { borderBottomColor: color }]}>
          {branding.logo ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- Image de react-pdf no admite alt.
            <Image src={branding.logo} style={styles.logo} />
          ) : (
            <Text style={[styles.brandName, { color }]}>{branding.displayName}</Text>
          )}
          <View style={styles.headerRight}>
            <Text style={[styles.kicker, { color }]}>Propuesta de ahorro en luz</Text>
            <Text style={[styles.muted, { marginTop: 2 }]}>
              Nº {doc.number} · {longDate(doc.generatedAt)}
            </Text>
          </View>
        </View>

        <Text style={styles.title}>{doc.client.name ? `Preparada para ${doc.client.name}` : "Estudio de su factura de luz"}</Text>
        <Text style={styles.subtitle}>
          {[doc.client.cups ? `CUPS ${doc.client.cups}` : null, "Tarifa 2.0TD", TERRITORY[supply.territory] ?? supply.territory]
            .filter(Boolean)
            .join(" · ")}
        </Text>

        <View style={styles.hero} wrap={false}>
          <View style={[styles.heroMain, { backgroundColor: color }]}>
            <Text style={styles.heroLabel}>{saves ? "Ahorro estimado" : "Coste estimado con la propuesta"}</Text>
            <Text style={styles.heroValue}>{euros(saves ? savings : offer.cost.total)}</Text>
            <Text style={styles.heroNote}>
              {saves && percent !== null ? `al año, un ${percent} % menos que hoy` : "al año, impuestos incluidos"}
            </Text>
            <Text style={styles.heroNote}>Unos {euros((saves ? savings : offer.cost.total) / 12)} al mes</Text>
          </View>
          {current && (
            <View style={styles.heroSide}>
              <CostBar
                label={`Hoy${current.supplierName ? ` con ${current.supplierName}` : ""}`}
                value={current.cost.total}
                max={costMax}
                color={TRACK}
              />
              <CostBar label={`Con ${offer.comercializadoraName}`} value={offer.cost.total} max={costMax} color={color} />
              <Text style={[styles.muted, styles.small]}>Total de un año con impuestos incluidos.</Text>
            </View>
          )}
        </View>

        <View style={[styles.offerCard, { borderLeftColor: color }]} wrap={false}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.kicker, styles.muted]}>Le proponemos</Text>
            <Text style={[styles.offerName, { marginTop: 3 }]}>{offer.comercializadoraName}</Text>
            <Text style={{ marginTop: 1 }}>{offer.productName}</Text>
            {chips.length > 0 && (
              <View style={styles.chips}>
                {chips.map((text) => (
                  <Text key={text} style={styles.chip}>
                    {text}
                  </Text>
                ))}
              </View>
            )}
          </View>
        </View>

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
                    <View key={period.label} style={{ width: `${share(period.value)}%`, backgroundColor: color, opacity: period.opacity }} />
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
            <HeadRow withToday={withToday} withDifference={false} />
            {priceRows(current?.prices ?? null, offer.prices).map((row) => (
              <Row key={row.label} {...row} withToday={withToday} />
            ))}
          </View>
        </View>

        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Coste de un año, concepto a concepto</Text>
          <HeadRow withToday={withToday} withDifference={withToday} />
          {costRows(current?.cost ?? null, offer.cost).map((row) => (
            <Row key={row.label} {...row} withToday={withToday} />
          ))}
          <Row
            label="Total al año, impuestos incluidos"
            today={current ? euros(current.cost.total) : undefined}
            offer={euros(offer.cost.total)}
            difference={
              current
                ? { text: delta(offer.cost.total - current.cost.total), good: offer.cost.total < current.cost.total }
                : undefined
            }
            withToday={withToday}
            total
          />
        </View>

        {powerNote && (
          <View style={[styles.note, { backgroundColor: powerNote.tone }]} wrap={false}>
            <View style={{ flex: 1 }}>
              <Text style={styles.noteTitle}>{powerNote.title}</Text>
              <Text>{powerNote.text}</Text>
            </View>
          </View>
        )}

        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Cómo seguir</Text>
          <View style={styles.steps}>
            {[
              `Confirme la propuesta con su asesor de ${branding.displayName}.`,
              "Con su DNI o CIF y el IBAN preparamos el contrato para que lo firme.",
              "El cambio no corta la luz ni cambia el contador, y no tiene que dar de baja su contrato actual.",
            ].map((text, index) => (
              <View key={text} style={styles.step}>
                <View style={[styles.stepNumber, { backgroundColor: color }]}>
                  <Text style={styles.stepDigit}>{index + 1}</Text>
                </View>
                <Text style={{ flex: 1 }}>{text}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.footer} fixed>
          Estimación de un año con su consumo y su potencia, los peajes, cargos e impuestos vigentes y los precios de
          {` ${offer.comercializadoraName}`} a {longDate(doc.priceDate)}. Lo que pague dependerá de su consumo real. Los
          precios pueden cambiar si la comercializadora los actualiza antes de la contratación. Propuesta preparada por{" "}
          {branding.displayName}.
        </Text>
      </Page>
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
