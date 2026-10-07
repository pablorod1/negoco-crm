/**
 * Enseña un Excel tal como lo ve la IA al crear una plantilla: cada hoja con
 * sus coordenadas. Solo lee; no llama a la IA.
 *
 *   pnpm tsx src/scripts/comparador/render-sheets.ts <fichero> [--max-rows 40]
 *                                                    [--recipe resultado.json]
 *
 * Con --recipe aplica la plantilla de un resultado del banco de pruebas
 * (`reader.definition`) y enseña las filas que lee y lo que no encaja, para
 * probar una plantilla sin pagar otra lectura.
 */
import { readFile } from "node:fs/promises";
import type { StoredRecipe } from "@/comparador/rates/sheets/apply";
import { readWorkbook, renderGrid, workbookSignature } from "@/comparador/rates/sheets/grid";
import { checkRecipe } from "@/comparador/rates/sheets/read";
import { readOption } from "../golden/paths";

async function main() {
  const argv = process.argv.slice(2);
  const file = argv.find(
    (arg, index) => !arg.startsWith("--") && !["--max-rows", "--recipe"].includes(argv[index - 1]),
  );
  if (!file) throw new Error("Uso: <fichero> [--max-rows 40] [--recipe resultado.json]");
  const maxRows = Number(readOption(argv, "--max-rows") ?? 40);
  const grids = readWorkbook(new Uint8Array(await readFile(file)));
  console.log(`firma: ${workbookSignature(grids)}`);

  const recipeFile = readOption(argv, "--recipe");
  if (recipeFile) {
    const saved = JSON.parse(await readFile(recipeFile, "utf8")) as
      | { reader?: { definition?: StoredRecipe } }
      | StoredRecipe;
    const recipe = "tables" in saved ? saved : saved.reader?.definition;
    if (!recipe) throw new Error("El fichero no trae plantilla (reader.definition)");
    const { healthy, report, applied } = checkRecipe(grids, recipe);
    const { extraction, sheets, rows } = applied;
    extraction.rates.forEach((rate, index) => {
      console.log(
        [
          `«${sheets[index]}» ${rows[index]}`,
          rate.productName,
          rate.level ?? "-",
          rate.territory,
          rate.pricing,
          rate.singlePrice ? "único" : "periodos",
          `E ${[rate.energyP1, rate.energyP2, rate.energyP3].join("/")} ${rate.energyUnit}`,
          `P ${rate.powerMode} ${[rate.powerP1, rate.powerP2].join("/")} ${rate.powerUnit ?? ""}`,
        ].join(" · "),
      );
    });
    for (const line of report) console.log(`! ${line}`);
    console.log(
      `${extraction.rates.length} filas, ${extraction.commissions.length} comisiones · ${healthy ? "encaja" : "no encaja"}`,
    );
    return;
  }

  for (const grid of grids) {
    const lines = renderGrid(grid).split("\n");
    console.log(lines.slice(0, maxRows + 1).join("\n"));
    if (lines.length > maxRows + 1) console.log(`… (${lines.length - 1} filas con datos)`);
    console.log();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
