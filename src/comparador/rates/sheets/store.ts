import type { Client } from "@libsql/client";
import { randomUUID } from "node:crypto";
import { getTursoControlClient } from "@/core/libsql/client";
import type { StoredRecipe } from "./apply";

/**
 * Plantillas de lectura de Excel por comercializadora y forma del libro. Son
 * comunes a todos los tenants: el Excel de Axpo es el mismo para todas las
 * agencias. Viven en la base de control (migración 025).
 */
export interface RecipeStore {
  /**
   * La plantilla de esa forma de libro o, si no hay, la última de la
   * comercializadora (`exact: false`): un libro con una hoja nueva se repara
   * a partir de ella en vez de escribirse de cero.
   */
  find(
    supplierKey: string,
    signature: string,
  ): Promise<{ id: string; recipe: StoredRecipe; exact: boolean } | null>;
  save(input: {
    supplierKey: string;
    signature: string;
    recipe: StoredRecipe;
    model: string;
  }): Promise<void>;
  /** Anota un uso: si ha servido o si ha habido que rehacerla. */
  record(id: string, worked: boolean): Promise<void>;
}

type ControlClient = Pick<Client, "execute">;

/** Sin la migración 025 la lectura sigue funcionando; solo no se guardan plantillas. */
function missingTable(error: unknown) {
  return error instanceof Error && /no such table/i.test(error.message);
}

export function controlRecipeStore(getClient: () => ControlClient = getTursoControlClient): RecipeStore {
  return {
    async find(supplierKey, signature) {
      try {
        const { rows } = await getClient().execute({
          sql: `SELECT id, recipe, signature = ? AS exact FROM rate_sheet_recipes
            WHERE supplier_key = ?
            ORDER BY exact DESC, updated_at DESC LIMIT 1`,
          args: [signature, supplierKey],
        });
        if (!rows[0]) return null;
        return {
          id: String(rows[0].id),
          recipe: JSON.parse(String(rows[0].recipe)) as StoredRecipe,
          exact: Number(rows[0].exact) === 1,
        };
      } catch (error) {
        if (missingTable(error)) {
          console.warn("[comparador] rate_sheet_recipes no existe: aplica la migración 025");
          return null;
        }
        throw error;
      }
    },

    async save({ supplierKey, signature, recipe, model }) {
      try {
        await getClient().execute({
          sql: `INSERT INTO rate_sheet_recipes (id, supplier_key, signature, recipe, model)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT (supplier_key, signature) DO UPDATE SET
              recipe = excluded.recipe,
              model = excluded.model,
              failures = 0,
              updated_at = CURRENT_TIMESTAMP`,
          args: [randomUUID(), supplierKey, signature, JSON.stringify(recipe), model],
        });
      } catch (error) {
        if (!missingTable(error)) throw error;
      }
    },

    async record(id, worked) {
      try {
        await getClient().execute({
          sql: worked
            ? `UPDATE rate_sheet_recipes SET uses = uses + 1, last_used_at = CURRENT_TIMESTAMP WHERE id = ?`
            : `UPDATE rate_sheet_recipes SET failures = failures + 1 WHERE id = ?`,
          args: [id],
        });
      } catch (error) {
        if (!missingTable(error)) throw error;
      }
    },
  };
}

/** Almacén en memoria para tests y para el banco de pruebas. */
export function memoryRecipeStore(): RecipeStore & {
  entries: Map<string, { id: string; recipe: StoredRecipe; uses: number; failures: number }>;
} {
  const entries = new Map<string, { id: string; recipe: StoredRecipe; uses: number; failures: number }>();
  return {
    entries,
    async find(supplierKey, signature) {
      const entry = entries.get(`${supplierKey}|${signature}`);
      if (entry) return { id: entry.id, recipe: entry.recipe, exact: true };
      const latest = [...entries]
        .filter(([key]) => key.startsWith(`${supplierKey}|`))
        .map(([, value]) => value)
        .at(-1);
      return latest ? { id: latest.id, recipe: latest.recipe, exact: false } : null;
    },
    async save({ supplierKey, signature, recipe }) {
      const existing = entries.get(`${supplierKey}|${signature}`);
      // La última guardada va al final, como el updated_at de la tabla.
      entries.delete(`${supplierKey}|${signature}`);
      entries.set(`${supplierKey}|${signature}`, {
        id: existing?.id ?? randomUUID(),
        recipe,
        uses: existing?.uses ?? 0,
        failures: 0,
      });
    },
    async record(id, worked) {
      for (const entry of entries.values()) {
        if (entry.id !== id) continue;
        if (worked) entry.uses++;
        else entry.failures++;
      }
    },
  };
}
