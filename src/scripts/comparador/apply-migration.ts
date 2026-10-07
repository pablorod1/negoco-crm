/**
 * Aplica un fichero SQL de migrations/ en una base concreta.
 *
 *   pnpm comparador:migrate --db control|test|beenergy|nasertel|eficience --file migrations/023_rate_catalog.sql
 *
 * No hay runner multi-tenant: cada migración se aplica a mano, base a base, en
 * el orden que indique su .md. Este script solo evita depender del CLI de
 * Turso, que puede apuntar a otra organización.
 */
import { createClient } from "@libsql/client";
import { readFile } from "node:fs/promises";
import { loadLocalEnv, readOption } from "../golden/paths";

const DATABASES: Record<string, [string, string]> = {
  control: ["NEXT_TURSO_CONTROL_DB_URL", "NEXT_TURSO_CONTROL_DB_AUTH_TOKEN"],
  test: ["NEXT_TURSO_DB_URL_TEST", "NEXT_TURSO_DB_AUTH_TOKEN_TEST"],
  beenergy: ["NEXT_TURSO_DB_URL_BEENERGY", "NEXT_TURSO_DB_AUTH_TOKEN_BEENERGY"],
  nasertel: ["NEXT_TURSO_DB_URL_NASERTEL", "NEXT_TURSO_DB_AUTH_TOKEN_NASERTEL"],
  eficience: ["NEXT_TURSO_DB_URL_EFICIENCE", "NEXT_TURSO_DB_AUTH_TOKEN_EFICIENCE"],
};

async function main() {
  loadLocalEnv();
  const argv = process.argv.slice(2);
  const target = readOption(argv, "--db");
  const file = readOption(argv, "--file");
  if (!target || !DATABASES[target] || !file?.endsWith(".sql")) {
    throw new Error(
      `Uso: --db ${Object.keys(DATABASES).join("|")} --file migrations/<fichero>.sql`,
    );
  }

  const [urlVar, tokenVar] = DATABASES[target];
  const url = process.env[urlVar];
  const authToken = process.env[tokenVar];
  if (!url || !authToken) throw new Error(`Faltan ${urlVar} o ${tokenVar}`);

  const sql = await readFile(file, "utf8");
  const db = createClient({ url, authToken });
  console.log(`Aplicando ${file} en ${target} (${new URL(url).host})…`);
  await db.executeMultiple(sql);
  console.log("Hecho.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
