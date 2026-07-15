import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/core/libsql/client";
import {
  getImaginaIntegrationStatus,
  IMAGINA_PROVIDER,
} from "@/core/integrations/imagina-energia";
import type { ImaginaRate } from "@/comercializadoras/types";

const SELECTED_RATE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

type RateRow = Record<string, unknown>;

const nullableString = (value: unknown): string | null =>
  value === null || value === undefined ? null : String(value);

const serializeRate = (row: RateRow): ImaginaRate => ({
  id: String(row.id),
  name: String(row.name),
  external_rate_id: nullableString(row.external_rate_id),
  alias_externo: nullableString(row.alias_externo),
  codigo_atr: nullableString(row.codigo_atr),
  descripcion: nullableString(row.descripcion),
  synced_at: nullableString(row.synced_at),
});

const getSelectedRateId = (
  request: NextRequest,
): { valid: true; value: string | null } | { valid: false } => {
  const values = request.nextUrl.searchParams.getAll("selected_rate_id");
  if (values.length === 0) return { valid: true, value: null };

  const [value] = values;
  if (values.length !== 1 || !SELECTED_RATE_ID_PATTERN.test(value)) {
    return { valid: false };
  }

  return { valid: true, value };
};

export async function GET(request: NextRequest) {
  const selectedRateId = getSelectedRateId(request);
  if (!selectedRateId.valid) {
    return NextResponse.json(
      { success: false, error: "selected_rate_id no es válido" },
      { status: 400 },
    );
  }

  try {
    const db = getTursoClient(request);
    const integration = await getImaginaIntegrationStatus(db);

    if (!integration.configured) {
      return NextResponse.json({
        success: true,
        data: {
          integration,
          rates: [],
          unavailable_selected_rate: null,
        },
      });
    }

    const result = await db.execute({
      sql: `SELECT id, name, external_rate_id, alias_externo, codigo_atr,
                   descripcion, synced_at
            FROM comercializadora_rates
            WHERE provider = ?
              AND enabled = 1
              AND external_rate_id IS NOT NULL
              AND TRIM(CAST(external_rate_id AS TEXT)) <> ''
              AND synced_at IS NOT NULL
              AND TRIM(CAST(synced_at AS TEXT)) <> ''
            ORDER BY codigo_atr ASC, alias_externo ASC, name ASC`,
      args: [IMAGINA_PROVIDER],
    });

    const rates = result.rows.map((row) => serializeRate(row));
    let unavailableSelectedRate: ImaginaRate | null = null;

    if (
      selectedRateId.value !== null &&
      !rates.some(
        (rate) =>
          rate.id === selectedRateId.value ||
          rate.external_rate_id === selectedRateId.value,
      )
    ) {
      const historicalResult = await db.execute({
        sql: `SELECT id, name, external_rate_id, alias_externo, codigo_atr,
                     descripcion, synced_at
              FROM comercializadora_rates
              WHERE provider = ?
                AND (id = ? OR external_rate_id = ?)
              LIMIT 1`,
        args: [
          IMAGINA_PROVIDER,
          selectedRateId.value,
          selectedRateId.value,
        ],
      });

      const historicalRate = historicalResult.rows[0];
      unavailableSelectedRate = historicalRate
        ? serializeRate(historicalRate)
        : null;
    }

    return NextResponse.json({
      success: true,
      data: {
        integration,
        rates,
        unavailable_selected_rate: unavailableSelectedRate,
      },
    });
  } catch (error) {
    console.error("Imagina tarifas list error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error al listar tarifas sincronizadas de Imagina",
      },
      { status: 500 },
    );
  }
}
