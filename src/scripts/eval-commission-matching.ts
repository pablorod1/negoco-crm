/**
 * Banco de pruebas del emparejamiento de comisiones con tarifas.
 *
 *   pnpm eval:commissions export
 *   pnpm eval:commissions run [--models a,b] [--cases eleia,axpo] [--max-usd 0.25] [--estimate]
 *
 * export: lee anexos de comisiones reales de los tenants (sin IA) y guarda en
 * ~/negoco-golden/comisiones un caso por anexo: las combinaciones distintas
 * de sus reglas (producto, nivel, energía, peaje, tipo de precio), las
 * tarifas vigentes de la comercializadora, lo que empareja el código sin
 * memoria (un anexo nuevo) y lo esperado (el código con las equivalencias que
 * eligió quien aprobó). `expected` se puede corregir a mano; `accept` admite
 * respuestas alternativas igual de válidas.
 *
 * run: pide a cada modelo el emparejamiento de cada caso y lo compara con lo
 * esperado. Un emparejamiento de más es grave (pagaría una comisión que no
 * toca); uno de menos solo manda la regla a revisión.
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { createGateway } from "ai";
import { z } from "zod";
import { generateStructured } from "@/comparador/ai/gateway";
import { getTursoClientByTenant, getTursoControlClient } from "@/core/libsql/client";
import { getIngest } from "@/comparador/rates/repository";
import { buildReview } from "@/comparador/rates/service";
import { loadLocalEnv, readOption } from "./golden/paths";

const DIR = join(homedir(), "negoco-golden", "comisiones");
const CHARS_PER_TOKEN = 3.5;

/** Anexos de comisiones reales: aprobados en test (revisados) y los del piloto. */
const CASES = [
  { name: "eleia-beenergy", tenant: "beenergy", ingest: "04b1db4d" },
  { name: "gana-beenergy", tenant: "beenergy", ingest: "628eda6e" },
  { name: "totalenergies-beenergy", tenant: "beenergy", ingest: "5da238ac" },
  { name: "eleia-test", tenant: "test", ingest: "d789ede6" },
  { name: "axpo-test", tenant: "test", ingest: "59f53883" },
  { name: "iberdrola-test", tenant: "test", ingest: "596e8174" },
  { name: "nordy-test", tenant: "test", ingest: "98f575e5" },
  { name: "repsol-test", tenant: "test", ingest: "d2783e82" },
  { name: "holaluz-test", tenant: "test", ingest: "7b609f19" },
  { name: "aletteo-test", tenant: "test", ingest: "d3dd44da" },
  { name: "acciona-test", tenant: "test", ingest: "695e066f" },
  { name: "apolo-test", tenant: "test", ingest: "4f226974" },
  { name: "contigo-test", tenant: "test", ingest: "969e90d7" },
];

interface MatchKey {
  id: string;
  product: string | null;
  level: string | null;
  energy: "electricity" | "gas";
  accessTariff: string | null;
  pricing: string | null;
  rules: number;
  /** Tarifas que cubre el código sin memoria de niveles. */
  code: string[];
  /** Lo correcto. */
  expected: string[];
  /** Otras respuestas igual de válidas. */
  accept?: string[][];
  /** Tarifas que también se pueden emparejar sin que cuente como error (casos dudosos). */
  allowed?: string[];
}

/**
 * Correcciones a mano de lo esperado, en overrides.json para que sobrevivan a
 * un nuevo export: por caso, la combinación («producto|nivel|energía|peaje|precio»)
 * con sus `accept` o `allowed`.
 */
type Overrides = Record<string, Record<string, Pick<MatchKey, "accept" | "allowed">>>;
const keySignature = (key: Pick<MatchKey, "product" | "level" | "energy" | "accessTariff" | "pricing">) =>
  [key.product ?? "", key.level ?? "", key.energy, key.accessTariff ?? "", key.pricing ?? ""].join("|");

interface MatchCase {
  name: string;
  supplier: string;
  rates: { label: string; accessTariff: string; pricing: string | null; energy: "electricity" | "gas" }[];
  keys: MatchKey[];
}

const energyOf = (tariff: string | null) => (tariff && /^RL/i.test(tariff) ? "gas" : "electricity");

async function exportCases() {
  await mkdir(DIR, { recursive: true });
  const control = getTursoControlClient();
  for (const spec of CASES) {
    const client = getTursoClientByTenant(spec.tenant);
    const { rows } = await client.execute({ sql: "SELECT id FROM rate_ingests WHERE id LIKE ?", args: [`${spec.ingest}%`] });
    const ingest = await getIngest(client, String(rows[0].id));
    if (!ingest?.comercializadoraId) {
      console.log(`${spec.name}: sin ingesta o sin comercializadora`);
      continue;
    }
    const today = new Date().toISOString().slice(0, 10);
    const remembered = (await buildReview({ client, control, ingest, today }))!.review;
    const fresh = (await buildReview({ client, control, ingest, today, decisions: { levelMap: {} } }))!.review;

    const keys = new Map<string, MatchKey>();
    remembered.commissions.forEach((rule, index) => {
      const freshRule = fresh.commissions[index];
      const level = rule.documentLevel ?? rule.level;
      const energy = rule.energy ?? "electricity";
      const signature = JSON.stringify([rule.product, level, energy, rule.accessTariff, rule.pricing]);
      const existing = keys.get(signature);
      if (existing) {
        existing.rules++;
        return;
      }
      keys.set(signature, {
        id: `K${keys.size + 1}`,
        product: rule.product,
        level,
        energy,
        accessTariff: rule.accessTariff,
        pricing: rule.pricing ?? null,
        rules: 1,
        code: freshRule.covers,
        expected: rule.covers,
      });
    });

    const prices = await client.execute({
      sql: `SELECT DISTINCT r.name, p.level, p.access_tariff, p.pricing
        FROM comercializadora_rate_prices p
        JOIN comercializadora_rate_versions v ON v.id = p.version_id
        JOIN comercializadora_rates r ON r.id = p.rate_id
        WHERE v.comercializadora_id = ? AND v.status = 'active'
        ORDER BY r.name, p.level, p.access_tariff`,
      args: [ingest.comercializadoraId],
    });
    const rates = new Map<string, MatchCase["rates"][number]>();
    for (const row of prices.rows) {
      const label = row.level ? `${row.name} (${row.level})` : String(row.name);
      const accessTariff = String(row.access_tariff);
      rates.set(`${label}|${accessTariff}`, {
        label,
        accessTariff,
        pricing: row.pricing ? String(row.pricing) : null,
        energy: energyOf(accessTariff),
      });
    }
    // Las tarifas del propio anexo (precios y comisiones juntos) también se
    // emparejan, aunque no estén vigentes: el modelo tiene que verlas.
    for (const key of keys.values()) {
      for (const label of [...key.code, ...key.expected]) {
        if ([...rates.values()].some((rate) => rate.label === label)) continue;
        const accessTariff = key.accessTariff ?? (key.energy === "gas" ? "RL.1" : "2.0TD");
        rates.set(`${label}|${accessTariff}`, { label, accessTariff, pricing: key.pricing, energy: key.energy });
      }
    }
    const out: MatchCase = { name: spec.name, supplier: remembered.supplier.name, rates: [...rates.values()], keys: [...keys.values()] };
    await writeFile(join(DIR, `${spec.name}.json`), `${JSON.stringify(out, null, 1)}\n`);
    const differ = out.keys.filter((key) => !sameSet(key.code, key.expected)).length;
    console.log(`${spec.name}: ${remembered.commissions.length} reglas → ${out.keys.length} combinaciones, ${out.rates.length} tarifas; el código sin memoria falla ${differ}`);
  }
}

const sameSet = (left: readonly string[], right: readonly string[]) =>
  left.length === right.length && left.every((item) => right.includes(item));

export const MATCHING_INSTRUCTIONS = `Emparejas las reglas de un anexo de comisiones de una comercializadora española de luz y gas con sus tarifas.
Cada combinación del anexo (producto, nivel, energía, peaje, tipo de precio) se aplica a las tarifas a las que se refiere. Devuelve, para cada combinación, los identificadores de esas tarifas.
- Solo tarifas de la misma energía. Si la combinación indica peaje (2.0TD, RL.1…), solo tarifas de ese peaje; si no lo indica, todas las de su energía.
- El producto puede venir escrito de otra forma: abreviado, con el nombre de la comercializadora, con «fijo», «indexado» o «(gas)» añadidos, o con un código de campaña («S3826»). El nivel puede ir aparte o dentro del nombre de la tarifa («TU DECIDES TDE 0» es el nivel TDE0 de TU DECIDES), y abreviado («S» por «SUPER (N1)», «TPoolE0» por «TRADERPOOL 0»).
- Sin producto, la regla vale para todos los productos; sin nivel, para todos los niveles del producto.
- El tipo de precio (fijo o indexado) no descarta tarifas: eso lo aplica el comparador después.
- Si no hay ninguna tarifa a la que se refiera, devuelve una lista vacía. No adivines: es mejor no emparejar que emparejar mal, porque una comisión mal emparejada se paga sin que nadie lo note.`;

const MatchSchema = z.object({
  matches: z.array(
    z.object({
      key: z.string().describe("Identificador de la combinación, K1, K2…"),
      rates: z.array(z.string()).describe("Identificadores de las tarifas, R1, R2…; vacío si ninguna"),
    }),
  ),
});

function prompt(matchCase: MatchCase) {
  const rates = matchCase.rates
    .map((rate, index) => `R${index + 1}: ${rate.label} · ${rate.accessTariff} · ${rate.pricing === "indexed" ? "indexado" : "fijo"}`)
    .join("\n");
  const keys = matchCase.keys
    .map(
      (key) =>
        `${key.id}: producto ${key.product ? `«${key.product}»` : "(sin producto)"} · nivel ${key.level ? `«${key.level}»` : "(sin nivel)"} · ${key.energy === "gas" ? "gas" : "luz"} · peaje ${key.accessTariff ?? "(cualquiera)"} · ${key.pricing ?? "(fijo o indexado)"}`,
    )
    .join("\n");
  return `Comercializadora: ${matchCase.supplier}\n\nTarifas:\n${rates}\n\nCombinaciones del anexo de comisiones:\n${keys}`;
}

async function loadCases(filter: string[] | null): Promise<MatchCase[]> {
  const files = (await readdir(DIR)).filter((file) => file.endsWith(".json") && !file.startsWith("run-") && file !== "overrides.json");
  const overrides: Overrides = JSON.parse(await readFile(join(DIR, "overrides.json"), "utf8").catch(() => "{}"));
  const cases = await Promise.all(files.map(async (file) => JSON.parse(await readFile(join(DIR, file), "utf8")) as MatchCase));
  for (const matchCase of cases) {
    for (const key of matchCase.keys) Object.assign(key, overrides[matchCase.name]?.[keySignature(key)] ?? {});
  }
  return cases.filter((matchCase) => !filter || filter.some((name) => matchCase.name.startsWith(name)));
}

function score(key: MatchKey, answer: string[]) {
  const valid = [key.expected, ...(key.accept ?? [])];
  const allowed = new Set([...valid.flat(), ...(key.allowed ?? [])]);
  if (valid.some((option) => sameSet(option, answer))) return "ok" as const;
  // Lo esperado y, como mucho, alguna de las permitidas en un caso dudoso.
  if (key.expected.every((label) => answer.includes(label)) && answer.every((label) => allowed.has(label))) {
    return "ok" as const;
  }
  // De más: alguna tarifa que ninguna respuesta válida incluye.
  return answer.some((label) => !allowed.has(label)) ? ("extra" as const) : ("missing" as const);
}

async function run(argv: string[]) {
  const models = (readOption(argv, "--models") ?? "google/gemini-2.5-flash,openai/gpt-6-luna").split(",");
  const maxUsd = Number(readOption(argv, "--max-usd") ?? 0.25);
  const cases = await loadCases(readOption(argv, "--cases")?.split(",") ?? null);

  const gateway = createGateway({ apiKey: process.env.VERCEL_AI_GATEWAY_API_KEY });
  const { models: available } = await gateway.getAvailableModels();
  const prices = new Map(
    available
      .filter((model) => model.pricing)
      .map((model) => [model.id, { input: Number(model.pricing!.input), output: Number(model.pricing!.output) }]),
  );
  let estimate = 0;
  for (const matchCase of cases) {
    const input = (MATCHING_INSTRUCTIONS.length + prompt(matchCase).length) / CHARS_PER_TOKEN;
    const output = matchCase.keys.length * 25;
    for (const model of models) {
      const price = prices.get(model);
      if (!price) throw new Error(`Sin precio en la Gateway para ${model}`);
      // Con razonamiento, la salida puede triplicarse.
      estimate += input * price.input + output * 3 * price.output;
    }
  }
  console.log(`${cases.length} casos × ${models.length} modelos · peor caso ${estimate.toFixed(4)} $ · tope ${maxUsd} $`);
  if (argv.includes("--estimate")) return;
  if (estimate > maxUsd) throw new Error("El peor caso pasa del tope: sube --max-usd o reduce casos.");

  const results: Record<string, unknown>[] = [];
  const code = { ok: 0, extra: 0, missing: 0 };
  for (const matchCase of cases) {
    for (const key of matchCase.keys) {
      const verdict = score(key, key.code);
      code[verdict]++;
      if (verdict !== "ok") results.push({ model: "código", case: matchCase.name, key: key.id, product: key.product, level: key.level, expected: key.expected, answer: key.code, verdict });
    }
  }
  for (const model of models) {
    const totals = { ok: 0, extra: 0, missing: 0, usd: 0, input: 0, output: 0, failed: 0 };
    for (const matchCase of cases) {
      const labels = new Map(matchCase.rates.map((rate, index) => [`R${index + 1}`, rate.label]));
      let output;
      try {
        output = await generateStructured({
          context: { tenantSlug: "eval", jobType: "rate_extraction", subjectId: `commission-matching:${matchCase.name}` },
          model,
          schema: MatchSchema,
          instructions: MATCHING_INSTRUCTIONS,
          messages: [{ role: "user", content: [{ type: "text", text: prompt(matchCase) }] }],
          reasoning: "low",
          maxOutputTokens: 16_000,
        });
      } catch (error) {
        totals.failed++;
        console.log(`  ${model} · ${matchCase.name}: falla (${error instanceof Error ? error.message.slice(0, 120) : error})`);
        continue;
      }
      totals.usd += output.costUsd ?? 0;
      totals.input += output.usage?.inputTokens ?? 0;
      totals.output += output.usage?.outputTokens ?? 0;
      const answers = new Map(output.output.matches.map((match) => [match.key, match.rates.map((id) => labels.get(id) ?? id)]));
      const caseScore = { ok: 0, extra: 0, missing: 0 };
      for (const key of matchCase.keys) {
        const answer = answers.get(key.id) ?? [];
        const verdict = score(key, answer);
        caseScore[verdict]++;
        totals[verdict]++;
        if (verdict !== "ok") {
          results.push({ model, case: matchCase.name, key: key.id, product: key.product, level: key.level, accessTariff: key.accessTariff, expected: key.expected, code: key.code, answer, verdict });
        }
      }
      const answered = matchCase.keys.filter((key) => answers.has(key.id)).length;
      console.log(`  ${model} · ${matchCase.name}: ${caseScore.ok}/${matchCase.keys.length} bien, ${caseScore.extra} de más, ${caseScore.missing} de menos · contesta ${answered} · ${(output.costUsd ?? 0).toFixed(4)} $`);
    }
    const total = totals.ok + totals.extra + totals.missing;
    console.log(`${model}: ${totals.ok}/${total} bien (${((100 * totals.ok) / total).toFixed(1)} %), ${totals.extra} de más, ${totals.missing} de menos, ${totals.failed} fallos · ${totals.usd.toFixed(4)} $ (${totals.input} + ${totals.output} tokens)\n`);
  }
  const total = code.ok + code.extra + code.missing;
  console.log(`Código sin memoria: ${code.ok}/${total} bien (${((100 * code.ok) / total).toFixed(1)} %), ${code.extra} de más, ${code.missing} de menos`);
  await writeFile(join(DIR, `run-${new Date().toISOString().replace(/[:.]/g, "-")}.json`), `${JSON.stringify(results, null, 1)}\n`);
}

async function main() {
  loadLocalEnv();
  const [command, ...argv] = process.argv.slice(2);
  if (command === "export") return exportCases();
  if (command === "run") return run(argv);
  console.log("Uso: pnpm eval:commissions export | run [--models a,b] [--cases x,y] [--max-usd 0.25] [--estimate]");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
