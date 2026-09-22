import { readFile } from "node:fs/promises";
import type { Client } from "@libsql/client";

// This migration only contains DDL; keep the checked-in SQL as the single source.
export async function migrateImaginaEnergia(client: Client, apply = false) {
  const source = await readFile(
    new URL("../../../docs/migrations/009_imagina_energia_integration.sql", import.meta.url),
    "utf8",
  );
  const statements = source.replace(/^--.*$/gm, "").split(";").map((sql) => sql.trim()).filter(Boolean);
  const transaction = await client.transaction(apply ? "write" : "read");
  const pending: string[] = [];
  const tablesCreatedByThisMigration = new Set<string>();
  try {
    for (const sql of statements) {
      const alter = sql.match(/^ALTER TABLE (\w+) ADD COLUMN (\w+) /i);
      if (alter) {
        const [, table, column] = alter;
        const { rows } = await transaction.execute(`PRAGMA table_info(${table})`);
        if (!rows.length && !tablesCreatedByThisMigration.has(table)) {
          throw new Error(`Falta la tabla base ${table}`);
        }
        if (rows.some((row) => row.name === column)) continue;
      } else {
        const create = sql.match(/^CREATE (?:UNIQUE )?(TABLE|INDEX) IF NOT EXISTS (\w+)/i);
        if (!create) throw new Error("La migración contiene una sentencia no soportada");
        if (create[1].toLowerCase() === "table") {
          tablesCreatedByThisMigration.add(create[2]);
        }
        const { rows } = await transaction.execute({
          sql: "SELECT name FROM sqlite_schema WHERE type = ? AND name = ?",
          args: [create[1].toLowerCase(), create[2]],
        });
        if (rows.length) continue;
      }
      pending.push(sql);
      if (apply) await transaction.execute(sql);
    }
    if (apply) await transaction.commit();
    else await transaction.rollback();
    return pending;
  } catch (error) {
    await transaction.rollback();
    throw error;
  } finally {
    transaction.close();
  }
}
