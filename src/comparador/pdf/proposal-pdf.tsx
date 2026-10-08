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
  `${value.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const price = (value: number) =>
  value.toLocaleString("es-ES", { minimumFractionDigits: 6, maximumFractionDigits: 6 });
const kw = (value: number) => `${value.toLocaleString("es-ES", { maximumFractionDigits: 3 })} kW`;
const kwh = (value: number) => `${Math.round(value).toLocaleString("es-ES")} kWh`;
const longDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Madrid",
  });

const INK = "#1f2937";
const MUTED = "#6b7280";
const LINE = "#e5e7eb";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: "Inter", color: INK },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  logo: { height: 32, maxWidth: 180, objectFit: "contain", objectPositionX: 0 },
  brandName: { fontSize: 14, fontWeight: 600 },
  headerRight: { alignItems: "flex-end" },
  muted: { color: MUTED },
  title: { fontSize: 16, fontWeight: 600, marginBottom: 4 },
  hero: { flexDirection: "row", marginTop: 14, marginBottom: 16, borderRadius: 6, overflow: "hidden" },
  heroMain: { flex: 1.2, padding: 14 },
  heroLabel: { fontSize: 9, color: "#ffffff", opacity: 0.85 },
  heroValue: { fontSize: 24, fontWeight: 600, color: "#ffffff", marginTop: 2 },
  heroNote: { fontSize: 9, color: "#ffffff", marginTop: 2 },
  heroSide: { flex: 1, padding: 14, backgroundColor: "#f9fafb", justifyContent: "center", gap: 8 },
  heroRow: { flexDirection: "row", justifyContent: "space-between" },
  bold: { fontWeight: 600 },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 11, fontWeight: 600, marginBottom: 6 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: LINE, paddingVertical: 4 },
  headRow: { flexDirection: "row", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: INK },
  cellLabel: { flex: 2 },
  cell: { flex: 1, textAlign: "right" },
  totalRow: { flexDirection: "row", paddingVertical: 5 },
  facts: { flexDirection: "row", gap: 8 },
  fact: { flex: 1, borderWidth: 1, borderColor: LINE, borderRadius: 4, padding: 8 },
  factValue: { fontSize: 11, fontWeight: 600, marginTop: 2 },
  bullet: { flexDirection: "row", marginBottom: 3 },
  footer: { position: "absolute", left: 36, right: 36, bottom: 24, fontSize: 7, color: MUTED },
});

function Row({ label, today, offer, bold }: { label: string; today: string; offer: string; bold?: boolean }) {
  return (
    <View style={bold ? styles.totalRow : styles.row}>
      <Text style={[styles.cellLabel, bold ? styles.bold : {}]}>{label}</Text>
      <Text style={[styles.cell, bold ? styles.bold : {}]}>{today}</Text>
      <Text style={[styles.cell, bold ? styles.bold : {}]}>{offer}</Text>
    </View>
  );
}

function priceRows(current: TariffPrices | null, offer: TariffPrices) {
  const show = (value: number | undefined) => (value === undefined ? "—" : price(value));
  return [
    { label: "Potencia punta P1 (€/kW·día)", today: show(current?.power.P1), offer: price(offer.power.P1) },
    { label: "Potencia valle P2 (€/kW·día)", today: show(current?.power.P2), offer: price(offer.power.P2) },
    { label: "Energía punta P1 (€/kWh)", today: show(current?.energy.P1), offer: price(offer.energy.P1) },
    { label: "Energía llano P2 (€/kWh)", today: show(current?.energy.P2), offer: price(offer.energy.P2) },
    { label: "Energía valle P3 (€/kWh)", today: show(current?.energy.P3), offer: price(offer.energy.P3) },
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
    .map(({ label, pick }) => ({ label, today: current ? euros(pick(current)) : "—", offer: euros(pick(offer)) }));
}

export function ProposalPdf({ document: doc, branding }: { document: ProposalDocument; branding: ProposalBranding }) {
  const { supply, offer, current, savings } = doc;
  const annual = supply.annualKwh.P1 + supply.annualKwh.P2 + supply.annualKwh.P3;
  const share = (value: number) => (annual > 0 ? ` (${Math.round((value / annual) * 100)} %)` : "");
  const saves = savings !== null && savings > 0;
  const percent = saves && current ? Math.round((savings / current.cost.total) * 100) : null;
  const conditions = [
    offer.termMonths ? `Contrato de ${offer.termMonths} meses.` : null,
    offer.powerMode === "regulated" ? "El término de potencia es el regulado (BOE), sin margen de la comercializadora." : null,
    ...offer.discounts,
    supply.power && supply.power.status === "exceeded"
      ? `Su máxima demanda de los últimos 12 meses fue de ${kw(supply.power.maxDemandKw)}, por encima de la potencia contratada. Le recomendamos subirla a ${kw(supply.power.suggestedKw)} para evitar cortes.`
      : null,
    supply.power && supply.power.status === "oversized"
      ? `Su máxima demanda de los últimos 12 meses fue de ${kw(supply.power.maxDemandKw)}. Podría bajar la potencia a ${kw(supply.power.suggestedKw)} y pagar menos de término fijo.`
      : null,
  ].filter((text): text is string => Boolean(text));
  const consumptionSource =
    supply.consumptionSource === "sips"
      ? `Consumo real de los últimos ${supply.sipsMonths ?? 12} meses según la distribuidora.`
      : "Consumo de su factura llevado a un año.";

  return (
    <Document title={`Propuesta ${doc.number} - ${offer.comercializadoraName}`} author={branding.displayName} language="es">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {branding.logo ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- Image de react-pdf no admite alt.
            <Image src={branding.logo} style={styles.logo} />
          ) : (
            <Text style={[styles.brandName, { color: branding.color }]}>{branding.displayName}</Text>
          )}
          <View style={styles.headerRight}>
            <Text style={styles.bold}>Propuesta de ahorro en luz</Text>
            <Text style={styles.muted}>
              Nº {doc.number} · {longDate(doc.generatedAt)}
            </Text>
          </View>
        </View>

        <Text style={styles.title}>{doc.client.name ? `Estudio para ${doc.client.name}` : "Estudio de su factura de luz"}</Text>
        {doc.client.cups && <Text style={styles.muted}>CUPS {doc.client.cups} · Tarifa 2.0TD · {TERRITORY[supply.territory] ?? supply.territory}</Text>}

        <View style={styles.hero}>
          <View style={[styles.heroMain, { backgroundColor: branding.color }]}>
            <Text style={styles.heroLabel}>{saves ? "Ahorro estimado" : "Coste estimado con la propuesta"}</Text>
            <Text style={styles.heroValue}>{saves ? `${euros(savings)} al año` : `${euros(offer.cost.total)} al año`}</Text>
            {percent !== null && <Text style={styles.heroNote}>Un {percent} % menos de lo que paga hoy</Text>}
          </View>
          <View style={styles.heroSide}>
            {current && (
              <View style={styles.heroRow}>
                <Text>Hoy{current.supplierName ? ` (${current.supplierName})` : ""}</Text>
                <Text style={styles.bold}>{euros(current.cost.total)}/año</Text>
              </View>
            )}
            <View style={styles.heroRow}>
              <Text>Con {offer.comercializadoraName}</Text>
              <Text style={styles.bold}>{euros(offer.cost.total)}/año</Text>
            </View>
            <Text style={styles.muted}>{offer.productName}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Su suministro</Text>
          <View style={styles.facts}>
            <View style={styles.fact}>
              <Text style={styles.muted}>Potencia contratada</Text>
              <Text style={styles.factValue}>
                {kw(supply.contractedKw.P1)} / {kw(supply.contractedKw.P2)}
              </Text>
              <Text style={styles.muted}>Punta / valle</Text>
            </View>
            <View style={styles.fact}>
              <Text style={styles.muted}>Consumo anual</Text>
              <Text style={styles.factValue}>{kwh(annual)}</Text>
              <Text style={styles.muted}>{consumptionSource}</Text>
            </View>
            <View style={styles.fact}>
              <Text style={styles.muted}>Reparto del consumo</Text>
              <Text>Punta {kwh(supply.annualKwh.P1)}{share(supply.annualKwh.P1)}</Text>
              <Text>Llano {kwh(supply.annualKwh.P2)}{share(supply.annualKwh.P2)}</Text>
              <Text>Valle {kwh(supply.annualKwh.P3)}{share(supply.annualKwh.P3)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Precios</Text>
          <View style={styles.headRow}>
            <Text style={[styles.cellLabel, styles.bold]}>Concepto</Text>
            <Text style={[styles.cell, styles.bold]}>Hoy</Text>
            <Text style={[styles.cell, styles.bold]}>Propuesta</Text>
          </View>
          {priceRows(current?.prices ?? null, offer.prices).map((row) => (
            <Row key={row.label} {...row} />
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Coste anual estimado</Text>
          <View style={styles.headRow}>
            <Text style={[styles.cellLabel, styles.bold]}>Concepto</Text>
            <Text style={[styles.cell, styles.bold]}>Hoy</Text>
            <Text style={[styles.cell, styles.bold]}>Propuesta</Text>
          </View>
          {costRows(current?.cost ?? null, offer.cost).map((row) => (
            <Row key={row.label} {...row} />
          ))}
          <Row
            label="Total al año, impuestos incluidos"
            today={current ? euros(current.cost.total) : "—"}
            offer={euros(offer.cost.total)}
            bold
          />
        </View>

        {conditions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Condiciones</Text>
            {conditions.map((text) => (
              <View key={text} style={styles.bullet}>
                <Text style={{ width: 10 }}>•</Text>
                <Text style={{ flex: 1 }}>{text}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.footer} fixed>
          Estimación de un año con su consumo y su potencia, los peajes, cargos e impuestos vigentes y los precios de
          {` ${offer.comercializadoraName}`} a {longDate(doc.priceDate)}. Lo que pague dependerá de su consumo real. Los
          precios pueden cambiar si la comercializadora los actualiza antes de la contratación. {branding.displayName}.
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
