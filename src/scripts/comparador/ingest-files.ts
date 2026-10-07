/**
 * Sube anexos de precios a un tenant y los lee, como el botón «Subir anexo».
 * La aprobación se hace después en Comercializadoras → Tarifas.
 *
 *   pnpm comparador:ingest --tenant test --supplier "Iberdrola" <fichero>… [--max-usd 0.25]
 *
 * Gasta crédito de la Gateway: se para antes de un fichero si el gasto medido
 * con el saldo ya ha llegado al tope.
 */
import { createClient } from "@libsql/client";
import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { createGateway } from "ai";
import { loadLocalEnv, readOption } from "../golden/paths";

const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xlsm": "application/vnd.ms-excel.sheet.macroEnabled.12",
  ".xls": "application/vnd.ms-excel",
  ".csv": "text/csv",
  ".txt": "text/plain",
};

async function main() {
  // Firebase lee su configuración al importarse: primero las variables.
  loadLocalEnv();
  const { randomUUID } = await import("node:crypto");
  const { createIngest, getComercializadora, getIngest } = await import("@/comparador/rates/repository");
  const { buildReview, findComercializadoraByName, processIngest, todayInSpain } = await import(
    "@/comparador/rates/service"
  );
  const { storeIngestFile } = await import("@/comparador/rates/storage");

  const argv = process.argv.slice(2);
  const tenant = readOption(argv, "--tenant");
  const supplierName = readOption(argv, "--supplier");
  const maxUsd = Number(readOption(argv, "--max-usd") ?? 0.25);
  const files = argv.filter(
    (arg, index) => !arg.startsWith("--") && !["--tenant", "--supplier", "--max-usd"].includes(argv[index - 1]),
  );
  if (!tenant || files.length === 0) {
    throw new Error('Uso: --tenant <tenant> [--supplier "Nombre"] <fichero>… [--max-usd 0.25]');
  }

  const client = createClient({
    url: process.env[`NEXT_TURSO_DB_URL_${tenant.toUpperCase()}`]!,
    authToken: process.env[`NEXT_TURSO_DB_AUTH_TOKEN_${tenant.toUpperCase()}`]!,
  });
  const control = createClient({
    url: process.env.NEXT_TURSO_CONTROL_DB_URL!,
    authToken: process.env.NEXT_TURSO_CONTROL_DB_AUTH_TOKEN!,
  });

  const supplier = supplierName ? await findComercializadoraByName(client, supplierName) : null;
  if (supplierName && !supplier) throw new Error(`No hay ninguna comercializadora «${supplierName}» en ${tenant}`);

  const gateway = createGateway({ apiKey: process.env.VERCEL_AI_GATEWAY_API_KEY });
  const balance = async () => Number((await gateway.getCredits()).balance);
  const start = await balance();

  for (const file of files) {
    const spent = start - (await balance());
    if (spent >= maxUsd) {
      console.log(`Tope alcanzado (${spent.toFixed(4)} $): no se lee ${basename(file)}.`);
      break;
    }

    const id = randomUUID();
    const data = new Uint8Array(await readFile(file));
    const stored = await storeIngestFile({
      tenantSlug: tenant,
      ingestId: id,
      name: basename(file),
      mime: MIME[extname(file).toLowerCase()] ?? "application/octet-stream",
      data,
    });
    await createIngest(client, {
      id,
      channel: "upload",
      comercializadoraId: supplier?.id ?? null,
      files: [stored],
      createdBy: "comparador:ingest",
    });
    const status = await processIngest({
      client,
      ingest: (await getIngest(client, id))!,
      tenantSlug: tenant,
      userId: null,
    }).catch((error: Error) => `failed: ${error.message}`);

    const ingest = (await getIngest(client, id))!;
    const owner = ingest.comercializadoraId
      ? (await getComercializadora(client, ingest.comercializadoraId))?.name
      : "sin comercializadora";
    console.log(`\n${basename(file)} → ${status} · ${owner} · ${(ingest.costUsd ?? 0).toFixed(4)} $ · ingesta ${id}`);

    const built = await buildReview({ client, control, ingest, today: todayInSpain() });
    if (!built) continue;
    const kinds = built.review.entries.reduce<Record<string, number>>((count, { kind }) => {
      count[kind] = (count[kind] ?? 0) + 1;
      return count;
    }, {});
    console.log(`  filas: ${JSON.stringify(kinds)} · comisiones: ${built.review.commissions.length}`);
    if (built.review.newProducts.length) {
      console.log(`  productos nuevos en el catálogo: ${built.review.newProducts.join(", ")}`);
    }
    for (const issue of built.review.issues.filter(({ severity }) => severity !== "info")) {
      console.log(`  [${issue.severity}] ${issue.message}`);
    }
  }
  console.log(`\nGastado: ${(start - (await balance())).toFixed(4)} $`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
