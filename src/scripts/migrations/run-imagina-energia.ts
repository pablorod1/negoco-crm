import { createClient } from "@libsql/client";
import { loadEnvConfig } from "@next/env";
import { migrateImaginaEnergia } from "./imagina-energia";

async function main() {
  const args = process.argv.slice(2);
  const tenant = args.find((arg) => arg.startsWith("--tenant="))?.slice(9);
  if (!tenant || !/^[a-z0-9_]+$/i.test(tenant) || args.some((arg) => arg !== "--apply" && arg !== `--tenant=${tenant}`)) {
    throw new Error("Uso: pnpm exec tsx src/scripts/migrations/run-imagina-energia.ts --tenant=TEST [--apply]");
  }
  loadEnvConfig(process.cwd(), true);
  const suffix = tenant.toUpperCase();
  const url = process.env[`NEXT_TURSO_DB_URL_${suffix}`];
  const authToken = process.env[`NEXT_TURSO_DB_AUTH_TOKEN_${suffix}`];
  if (!url || !authToken) throw new Error(`Falta configuración Turso para ${suffix}`);
  const client = createClient({ url, authToken });
  try {
    const statements = await migrateImaginaEnergia(client, args.includes("--apply"));
    console.log(`${suffix}: ${statements.length} sentencias ${args.includes("--apply") ? "aplicadas" : "pendientes"}`);
    if (!args.includes("--apply")) statements.forEach((sql) => console.log(`${sql};`));
  } finally {
    client.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Error de migración");
  process.exitCode = 1;
});
