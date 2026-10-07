/**
 * Estado de las tablas del comparador en la base de control y en cada tenant.
 *
 *   pnpm comparador:preflight
 *
 * Solo lee. Sirve para ver qué hay antes de aplicar las migraciones 023 y 024
 * y, antes de mergear, para comprobar que están aplicadas en todos los tenants.
 */
import { createClient, type Client } from "@libsql/client";
import { loadLocalEnv } from "../golden/paths";

const TENANTS = ["TEST", "BEENERGY", "NASERTEL", "EFICIENCE"] as const;

const CONTROL_TABLES = [
  "tenant_modules",
  "ai_usage_events",
  "rate_catalog",
  "rate_catalog_aliases",
  "rate_sheet_recipes",
];

const TENANT_TABLES = [
  "comercializadora_rates",
  "comercializadora_rate_versions",
  "comercializadora_rate_prices",
  "rate_ingests",
  "rate_commission_rules",
  "comparison_studies",
];

async function existingTables(db: Client, names: readonly string[]) {
  const { rows } = await db.execute({
    sql: `SELECT name FROM sqlite_master WHERE type = 'table'
      AND name IN (${names.map(() => "?").join(", ")})`,
    args: [...names],
  });
  return new Set(rows.map((row) => String(row.name)));
}

async function describeTable(db: Client, table: string) {
  const columns = await db.execute(`PRAGMA table_info(${table})`);
  const count = await db.execute(`SELECT COUNT(*) AS n FROM ${table}`);
  return {
    columns: columns.rows.map((row) => `${row.name} ${row.type}`).join(", "),
    rows: Number(count.rows[0].n),
  };
}

function connect(urlVar: string, tokenVar: string) {
  const url = process.env[urlVar];
  const authToken = process.env[tokenVar];
  if (!url || !authToken) return null;
  return createClient({ url, authToken });
}

async function report(label: string, db: Client, tables: readonly string[]) {
  const present = await existingTables(db, tables);
  console.log(`\n== ${label}`);
  for (const table of tables) {
    if (!present.has(table)) {
      console.log(`  ${table}: NO EXISTE`);
      continue;
    }
    const { columns, rows } = await describeTable(db, table);
    console.log(`  ${table}: ${rows} filas`);
    console.log(`    ${columns}`);
  }
}

async function main() {
  loadLocalEnv();

  const control = connect(
    "NEXT_TURSO_CONTROL_DB_URL",
    "NEXT_TURSO_CONTROL_DB_AUTH_TOKEN",
  );
  if (control) await report("control", control, CONTROL_TABLES);
  else console.log("\n== control: faltan las credenciales");

  for (const tenant of TENANTS) {
    const db = connect(
      `NEXT_TURSO_DB_URL_${tenant}`,
      `NEXT_TURSO_DB_AUTH_TOKEN_${tenant}`,
    );
    if (!db) {
      console.log(`\n== ${tenant.toLowerCase()}: faltan las credenciales`);
      continue;
    }
    await report(tenant.toLowerCase(), db, TENANT_TABLES);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
