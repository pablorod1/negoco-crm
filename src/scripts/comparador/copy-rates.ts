/**
 * Copia los precios vigentes de un tenant a otro (el de demo recibe los de
 * Beenergy). Sin --apply solo enseña el plan.
 *
 *   pnpm comparador:copy-rates --from beenergy --to demo [--apply]
 *
 * Cada comercializadora con versión vigente en el origen recibe en el destino
 * una versión nueva (source = 'copy') con las mismas filas. Solo se copian
 * las tarifas enlazadas al catálogo.
 */
import { createClient } from "@libsql/client";
import { planRatesCopy } from "@/comparador/rates/copy";
import { todayInSpain } from "@/comparador/rates/service";
import { loadLocalEnv, readOption } from "../golden/paths";

function tenantClient(slug: string) {
  const url = process.env[`NEXT_TURSO_DB_URL_${slug.toUpperCase()}`];
  const authToken = process.env[`NEXT_TURSO_DB_AUTH_TOKEN_${slug.toUpperCase()}`];
  if (!url || !authToken) throw new Error(`Faltan las credenciales del tenant ${slug}`);
  return createClient({ url, authToken });
}

async function main() {
  loadLocalEnv();
  const argv = process.argv.slice(2);
  const from = readOption(argv, "--from");
  const to = readOption(argv, "--to");
  if (!from || !to || from === to) {
    throw new Error("Uso: --from <tenant> --to <tenant> [--apply]");
  }

  const target = tenantClient(to);
  const { entries, missingSuppliers } = await planRatesCopy({
    from: tenantClient(from),
    to: target,
    today: todayInSpain(),
    userId: "copy-rates",
  });

  for (const entry of entries) {
    console.log(
      `${entry.supplier}: ${entry.rows} filas desde ${entry.validFrom}` +
        (entry.newRates.length ? ` · tarifas nuevas: ${entry.newRates.join(", ")}` : "") +
        (entry.skippedRows ? ` · ${entry.skippedRows} filas sin catálogo, no se copian` : ""),
    );
  }
  if (missingSuppliers.length) {
    console.log(`Sin comercializadora en ${to}: ${missingSuppliers.join(", ")}`);
  }
  if (!argv.includes("--apply")) {
    console.log("\nSolo plan. Repite con --apply para escribir.");
    return;
  }
  for (const entry of entries) {
    await target.batch(entry.statements, "write");
  }
  console.log(`\nCopiadas ${entries.length} comercializadoras a ${to}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
