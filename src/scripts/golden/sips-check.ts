/**
 * Contrasta las fichas con el SIPS de APOLO: consumo por periodo en las fechas
 * de la factura y potencia contratada.
 *
 *   pnpm golden:sips [--dir <carpeta>] [--yes]
 *
 * Sin --yes solo dice cuántas consultas haría. El CUPS se lee de la carpeta
 * privada y no se imprime ni se guarda en el resultado.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { InvoiceExtractionSchema } from "@/comparador/extraction/invoice-schema";
import { fetchApoloSipsProcedure } from "@/integrations/apolo-sips/server";
import type {
  ApoloSipsElectricityConsumptionRow,
  ApoloSipsElectricityPointSupplyRow,
} from "@/integrations/apolo-sips/types";
import { DEFAULT_GOLDEN_DIR, goldenPath, loadLocalEnv, readOption } from "./paths";
import type { SipsCheck } from "./statuses";

/** Margen en días al casar el periodo de la factura con un mes del SIPS. */
const DATE_TOLERANCE_DAYS = 3;
const KWH_TOLERANCE = 1;

const day = (value: string | null) => (value ? Date.parse(value.slice(0, 10)) : NaN);

function sameDay(a: number, b: number) {
  return Math.abs(a - b) <= DATE_TOLERANCE_DAYS * 86_400_000;
}

async function main() {
  loadLocalEnv();
  const argv = process.argv.slice(2);
  const root = readOption(argv, "--dir") ?? DEFAULT_GOLDEN_DIR;
  const execute = argv.includes("--yes");
  const apiKey = process.env.APOLO_SIPS_API_KEY;

  const ids = (await readdir(goldenPath(root, "fichas", "")))
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.slice(0, -5));

  if (!execute) {
    console.log(`Haría ${ids.length * 2} consultas al SIPS (${ids.length} fichas × PS y CONSUMOS). Añade --yes para lanzarlas.`);
    return;
  }
  if (!apiKey) throw new Error("Falta APOLO_SIPS_API_KEY");

  const summary = { match: 0, partial: 0, noData: 0, failed: 0 };

  for (const id of ids) {
    try {
      const ficha = InvoiceExtractionSchema.parse(
        JSON.parse(await readFile(goldenPath(root, "fichas", `${id}.json`), "utf8")),
      );
      const { cups } = JSON.parse(
        await readFile(goldenPath(root, "private", `${id}.json`), "utf8"),
      ) as { cups: string[] };
      if (!cups[0] || !ficha.billingPeriod) {
        summary.noData += 1;
        continue;
      }

      const [consumption, pointSupply] = await Promise.all([
        fetchApoloSipsProcedure({ apiKey, cups: cups[0], procedure: "CONSUMOS", supplyType: "ELECTRICIDAD" }),
        fetchApoloSipsProcedure({ apiKey, cups: cups[0], procedure: "PS", supplyType: "ELECTRICIDAD" }),
      ]);

      const from = day(ficha.billingPeriod.from);
      const to = day(ficha.billingPeriod.to);
      const month = (consumption.rows as ApoloSipsElectricityConsumptionRow[]).find(
        (row) =>
          sameDay(day(row.fechaInicioMesConsumo), from) &&
          sameDay(day(row.fechaFinMesConsumo), to),
      );
      const kwh = (wh: number | null) => (wh ?? 0) / 1000;
      const closeTo = (expected: number | null, actual: number) =>
        expected !== null && Math.abs(expected - actual) <= KWH_TOLERANCE;

      const ps = (pointSupply.rows as ApoloSipsElectricityPointSupplyRow[])[0];
      const check: SipsCheck = {
        consumption: month
          ? {
              P1: closeTo(ficha.consumptionKwh.P1, kwh(month.consumoEnergiaActivaEnWhP1)),
              P2: closeTo(ficha.consumptionKwh.P2, kwh(month.consumoEnergiaActivaEnWhP2)),
              P3: closeTo(ficha.consumptionKwh.P3, kwh(month.consumoEnergiaActivaEnWhP3)),
            }
          : null,
        contractedPower: ps
          ? ficha.contractedKw.P1 === kwh(ps.potenciasContratadasEnWP1) &&
            ficha.contractedKw.P2 === kwh(ps.potenciasContratadasEnWP2)
          : null,
      };
      await writeFile(goldenPath(root, "sips", `${id}.json`), JSON.stringify(check, null, 2));

      const all = check.consumption && Object.values(check.consumption).every(Boolean) && check.contractedPower;
      if (!check.consumption && check.contractedPower === null) summary.noData += 1;
      else if (all) summary.match += 1;
      else summary.partial += 1;
    } catch {
      summary.failed += 1;
    }
  }

  console.log("Contraste con el SIPS:", summary);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
