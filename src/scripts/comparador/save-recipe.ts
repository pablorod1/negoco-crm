/**
 * Guarda en control una plantilla de Excel escrita a mano, para los libros
 * que la IA barata no consigue leer. Solo la guarda si pasa las mismas
 * comprobaciones que una de la IA (sin duplicados, sin filas 2.0TD sin leer,
 * territorios coherentes…). A partir de ahí, ese formato se lee sin IA y los
 * cambios de cada mes se reparan desde ella.
 *
 *   pnpm tsx src/scripts/comparador/save-recipe.ts --tenant test --supplier "YaLuz" \
 *     <excel> <plantilla.json> [--apply]
 *
 * Sin --apply solo comprueba y enseña las filas que lee.
 */
import { createClient } from "@libsql/client";
import { readFile } from "node:fs/promises";
import { loadLocalEnv, readOption } from "../golden/paths";

async function main() {
  loadLocalEnv();
  const { findComercializadoraByName } = await import("@/comparador/rates/service");
  const { normalizeName } = await import("@/comparador/rates/names");
  const { readWorkbook, workbookSignature } = await import("@/comparador/rates/sheets/grid");
  const { checkRecipe, prepareRecipe } = await import("@/comparador/rates/sheets/read");
  const { SheetRecipeSchema } = await import("@/comparador/rates/sheets/recipe");
  const { controlRecipeStore } = await import("@/comparador/rates/sheets/store");

  const argv = process.argv.slice(2);
  const tenant = readOption(argv, "--tenant");
  const supplierName = readOption(argv, "--supplier");
  const [workbookFile, recipeFile] = argv.filter(
    (arg, index) => !arg.startsWith("--") && !["--tenant", "--supplier"].includes(argv[index - 1]),
  );
  if (!tenant || !supplierName || !workbookFile || !recipeFile) {
    throw new Error('Uso: --tenant <tenant> --supplier "Nombre" <excel> <plantilla.json> [--apply]');
  }

  // La plantilla se busca por el nombre de la comercializadora en el CRM.
  const client = createClient({
    url: process.env[`NEXT_TURSO_DB_URL_${tenant.toUpperCase()}`]!,
    authToken: process.env[`NEXT_TURSO_DB_AUTH_TOKEN_${tenant.toUpperCase()}`]!,
  });
  const supplier = await findComercializadoraByName(client, supplierName);
  if (!supplier) throw new Error(`No hay ninguna comercializadora «${supplierName}» en ${tenant}`);

  const grids = readWorkbook(new Uint8Array(await readFile(workbookFile)));
  const recipe = prepareRecipe(grids, SheetRecipeSchema.parse(JSON.parse(await readFile(recipeFile, "utf8"))));
  const { healthy, report, applied } = checkRecipe(grids, recipe);

  applied.extraction.rates.forEach((rate, index) => {
    console.log(
      [
        `«${applied.sheets[index]}» ${applied.rows[index]}`,
        rate.productName,
        rate.level ?? "-",
        rate.territory,
        rate.pricing,
        rate.singlePrice ? "único" : "periodos",
        `E ${[rate.energyP1, rate.energyP2, rate.energyP3].join("/")} ${rate.energyUnit}`,
        `P ${rate.powerMode} ${[rate.powerP1, rate.powerP2].join("/")} ${rate.powerUnit ?? ""}`,
        rate.minKwh !== null || rate.maxKwh !== null ? `kWh ${rate.minKwh ?? ""}-${rate.maxKwh ?? ""}` : "",
        rate.minKw !== null || rate.maxKw !== null ? `kW ${rate.minKw ?? ""}-${rate.maxKw ?? ""}` : "",
        rate.months !== null ? `${rate.months} meses` : "",
        rate.startFrom ? `inicio ${rate.startFrom}` : "",
        rate.feeMinMwh !== null ? `fee ${rate.feeMinMwh}-${rate.feeMaxMwh}` : "",
      ].join(" · "),
    );
  });
  for (const line of report) console.log(`! ${line}`);
  for (const note of applied.notes) console.log(`· ${note}`);

  const supplierKey = normalizeName(supplier.name);
  const signature = workbookSignature(grids);
  console.log(
    `\n${applied.extraction.rates.length} filas · ${supplier.name} (${supplierKey}) · firma ${signature} · ${healthy ? "encaja" : "NO encaja"}`,
  );
  if (!healthy) process.exit(1);
  if (!argv.includes("--apply")) return;

  const control = createClient({
    url: process.env.NEXT_TURSO_CONTROL_DB_URL!,
    authToken: process.env.NEXT_TURSO_CONTROL_DB_AUTH_TOKEN!,
  });
  await controlRecipeStore(() => control).save({ supplierKey, signature, recipe, model: "manual" });
  console.log("Guardada en control.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
