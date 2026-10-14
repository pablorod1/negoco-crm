/**
 * Prueba de Jev (TypeSafe AI), un modelo de decisión, como verificador de la
 * lectura y como clasificador del documento.
 *
 *   pnpm golden:jev [--dir <carpeta>] [--max-usd 0.10] [--out informe.json]
 *
 * 1. Verificación: por cada factura del banco, pregunta sí/no por los valores
 *    que leyó GPT-6 Luna (consumo por periodo, días, potencia, comercializadora,
 *    autoconsumo) y por un valor falso a propósito. Un buen verificador da
 *    probabilidad alta al verdadero y baja al falso. La referencia es la ficha.
 * 2. Clasificación: las facturas del banco y los documentos excluidos (no son
 *    facturas o no son 2.0TD).
 *
 * Solo envía el texto anonimizado.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createGateway, experimental_decide as decide, type Experimental_DecisionQuestion } from "ai";
import { InvoiceExtractionSchema, type InvoiceExtraction } from "@/comparador/extraction/invoice-schema";
import { DEFAULT_GOLDEN_DIR, goldenPath, loadLocalEnv, readOption } from "./paths";

const MODEL = "typesafe-ai/jev";
const PRICE_PER_TOKEN = 0.042 / 1e6;

const DOCUMENT_KINDS = {
  factura_2_0td: "Factura de electricidad de un suministro con peaje 2.0TD (hasta 15 kW)",
  factura_otra_tarifa: "Factura de electricidad con peaje 3.0TD, 6.1TD u otro distinto de 2.0TD",
  contrato: "Contrato, condiciones particulares o generales de suministro",
  estudio_comparativo: "Estudio, simulación o comparativa de ahorro hecha por otra empresa",
  hoja_precios: "Hoja de precios, tarifas o condiciones de un producto",
  otro: "Otro documento",
} as const;

interface Statement {
  field: string;
  /** Lo que se pregunta es verdad según la ficha. */
  expected: boolean;
  /** Pregunta por la lectura de Luna (no por un valor falso a propósito). */
  fromReading: boolean;
  question: Experimental_DecisionQuestion;
}

const kwh = (value: number) => value.toLocaleString("es-ES", { maximumFractionDigits: 3 });
const same = (a: number | null, b: number | null) => a !== null && b !== null && Math.abs(a - b) < 0.5;

function statementsFor(ficha: InvoiceExtraction, reading: InvoiceExtraction): Statement[] {
  const out: Statement[] = [];
  const ask = (field: string, instructions: string, expected: boolean, fromReading: boolean) =>
    out.push({ field, expected, fromReading, question: { type: "boolean", instructions } });

  const periods = { P1: "punta (P1)", P2: "llano (P2)", P3: "valle (P3)" } as const;
  for (const period of ["P1", "P2", "P3"] as const) {
    const read = reading.consumptionKwh[period];
    const truth = ficha.consumptionKwh[period];
    if (read === null || truth === null) continue;
    const say = (value: number) =>
      `El consumo del periodo de ${periods[period]} en esta factura es de ${kwh(value)} kWh. Puede aparecer en el resumen, en las líneas de energía o en la tabla de lecturas por periodo (lectura anterior, lectura actual y consumo de punta, llano y valle).`;
    ask(`consumo ${period}`, say(read), same(read, truth), true);
    const other = (["P1", "P2", "P3"] as const).map((p) => ficha.consumptionKwh[p]).find((v) => v !== null && !same(v, truth));
    const wrong = other ?? Math.round(truth * 1.12 + 3);
    ask(`consumo ${period}`, say(wrong), false, false);
  }

  const days = reading.billingPeriod?.days ?? null;
  const trueDays = ficha.billingPeriod?.days ?? null;
  if (days !== null && trueDays !== null) {
    const say = (value: number) => `El periodo facturado es de ${value} días.`;
    ask("días", say(days), days === trueDays, true);
    ask("días", say(trueDays + 3), false, false);
  }

  const kw = reading.contractedKw.P1;
  const trueKw = ficha.contractedKw.P1;
  if (kw !== null && trueKw !== null) {
    const say = (value: number) => `La potencia contratada en punta (P1) es de ${kwh(value)} kW.`;
    ask("potencia P1", say(kw), Math.abs(kw - trueKw) < 0.01, true);
    ask("potencia P1", say(Math.round((trueKw + 1.15) * 100) / 100), false, false);
  }

  if (reading.supplierName && ficha.supplierName) {
    const norm = (name: string) => name.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "").slice(0, 6);
    const say = (name: string) => `La comercializadora que emite la factura es ${name}.`;
    ask("comercializadora", say(reading.supplierName), norm(reading.supplierName) === norm(ficha.supplierName), true);
    const decoy = /endesa/i.test(ficha.supplierName) ? "Iberdrola Clientes" : "Endesa Energía";
    ask("comercializadora", say(decoy), false, false);
  }

  ask(
    "autoconsumo",
    "La factura incluye autoconsumo o compensación de excedentes de energía vertida a la red.",
    ficha.hasSelfConsumption,
    false,
  );
  return out;
}

async function main() {
  loadLocalEnv();
  const argv = process.argv.slice(2);
  const root = readOption(argv, "--dir") ?? DEFAULT_GOLDEN_DIR;
  const maxUsd = Number(readOption(argv, "--max-usd") ?? 0.1);
  const out = readOption(argv, "--out");
  const gateway = createGateway({ apiKey: process.env.VERCEL_AI_GATEWAY_API_KEY });

  const readings = new Map<string, InvoiceExtraction>();
  const report = JSON.parse(readFileSync(join(root, "eval", "cuadre-luna-reglas.json"), "utf8")) as {
    results: { id: string; extraction: unknown }[];
  };
  for (const { id, extraction } of report.results) readings.set(id, InvoiceExtractionSchema.parse(extraction));

  // Documentos: las facturas del banco y los excluidos con su tipo real.
  const docs: { id: string; kind: keyof typeof DOCUMENT_KINDS }[] = readdirSync(goldenPath(root, "fichas", "")).map((file) => ({
    id: file.slice(0, -5),
    kind: "factura_2_0td",
  }));
  const KIND_OF_EXCLUSION: [RegExp, keyof typeof DOCUMENT_KINDS][] = [
    [/estudio/i, "estudio_comparativo"],
    [/contrato/i, "contrato"],
    [/hoja de precios/i, "hoja_precios"],
    [/6\.1TD|3\.0TD|fuera de alcance/i, "factura_otra_tarifa"],
  ];
  for (const file of readdirSync(goldenPath(root, "review", ""))) {
    const id = file.slice(0, -5);
    const excluded = (JSON.parse(readFileSync(goldenPath(root, "review", file), "utf8")) as { excluded?: string }).excluded;
    const kind = excluded ? KIND_OF_EXCLUSION.find(([pattern]) => pattern.test(excluded))?.[1] : undefined;
    if (kind && existsSync(goldenPath(root, "redacted", `${id}.txt`))) docs.push({ id, kind });
  }

  let spent = 0;
  const verification: { id: string; field: string; expected: boolean; fromReading: boolean; probability: number }[] = [];
  const classification: { id: string; kind: string; choice: string; probability: number }[] = [];

  for (const { id, kind } of docs) {
    if (spent >= maxUsd) {
      console.log("Parado por el tope de gasto.");
      break;
    }
    const text = readFileSync(goldenPath(root, "redacted", `${id}.txt`), "utf8");
    const ficha = existsSync(goldenPath(root, "fichas", `${id}.json`))
      ? InvoiceExtractionSchema.parse(JSON.parse(readFileSync(goldenPath(root, "fichas", `${id}.json`), "utf8")))
      : null;
    const reading = readings.get(id);
    const statements = ficha && reading ? statementsFor(ficha, reading) : [];

    const questions: Record<string, Experimental_DecisionQuestion> = {
      tipo: { type: "choice", instructions: "¿Qué es este documento?", criteria: DOCUMENT_KINDS },
    };
    statements.forEach((statement, index) => (questions[`q${index}`] = statement.question));

    try {
      const result = await decide({
        model: gateway.decisionModel(MODEL),
        state: `Texto de un documento subido como factura de luz. Los datos personales están tapados entre corchetes.\n\n${text}`,
        questions,
      });
      spent += (result.usage.inputTokens ?? 0) * PRICE_PER_TOKEN;
      const answers = result.answers as Record<string, { type: string; probability?: number; choice?: string; probabilities?: Record<string, number> }>;
      const tipo = answers.tipo;
      classification.push({ id, kind, choice: tipo.choice ?? "?", probability: tipo.probabilities?.[tipo.choice ?? ""] ?? NaN });
      statements.forEach((statement, index) => {
        const answer = answers[`q${index}`];
        if (answer?.type !== "boolean" || answer.probability === undefined) return;
        const { field, expected, fromReading } = statement;
        verification.push({ id, field, expected, fromReading, probability: answer.probability });
      });
      process.stdout.write(".");
    } catch (error) {
      console.error(`\n${id}: ${(error as Error).message.slice(0, 160)}`);
    }
  }
  console.log("");

  // Clasificación
  const correct = classification.filter(({ kind, choice }) => kind === choice).length;
  console.log(`Clasificación: ${correct}/${classification.length} acertadas`);
  for (const miss of classification.filter(({ kind, choice }) => kind !== choice)) {
    console.log(`  ${miss.id}: es ${miss.kind}, dice ${miss.choice} (${miss.probability.toFixed(2)})`);
  }

  // Verificación: separa lo verdadero de lo falso?
  const truths = verification.filter(({ expected }) => expected);
  const lies = verification.filter(({ expected }) => !expected);
  const rate = (list: typeof verification, test: (p: number) => boolean) =>
    list.length ? `${list.filter(({ probability }) => test(probability)).length}/${list.length}` : "0/0";
  console.log(`Verificación: ${verification.length} afirmaciones`);
  console.log(`  verdaderas con p ≥ 0,9: ${rate(truths, (p) => p >= 0.9)} · con p < 0,5: ${rate(truths, (p) => p < 0.5)}`);
  console.log(`  falsas con p ≤ 0,1: ${rate(lies, (p) => p <= 0.1)} · con p > 0,5: ${rate(lies, (p) => p > 0.5)}`);
  const lunaWrong = verification.filter(({ fromReading, expected }) => fromReading && !expected);
  console.log(`  lecturas de Luna que no coinciden con la ficha: ${lunaWrong.length}`);
  for (const wrong of lunaWrong) console.log(`    ${wrong.id} ${wrong.field}: p = ${wrong.probability.toFixed(2)}`);
  const byField = new Map<string, { truths: number[]; lies: number[] }>();
  for (const { field, expected, probability } of verification) {
    const entry = byField.get(field) ?? { truths: [], lies: [] };
    (expected ? entry.truths : entry.lies).push(probability);
    byField.set(field, entry);
  }
  const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : NaN);
  for (const [field, { truths: t, lies: l }] of byField) {
    console.log(`  ${field.padEnd(16)} p media verdaderas ${mean(t).toFixed(2)} (${t.length}) · falsas ${mean(l).toFixed(2)} (${l.length})`);
  }
  console.log(`Coste estimado: ${spent.toFixed(4)} $`);
  if (out) writeFileSync(out, JSON.stringify({ classification, verification }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
