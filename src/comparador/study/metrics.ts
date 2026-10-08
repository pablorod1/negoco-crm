import type { Client } from "@libsql/client";

/** Uso del comparador en un mes: la base del cupo del plan y de si el estudio acaba en contrato. */
export interface StudyMonthMetrics {
  /** YYYY-MM (UTC, como created_at). */
  month: string;
  /** Facturas analizadas: cada una gasta IA y cuenta para el cupo. */
  analyses: number;
  /** Estudios completados con una propuesta. */
  completed: number;
  /** Completados cuya comparativa ya es trámite. */
  inTramite: number;
  aiCostUsd: number;
  /** Ahorro medio al año de las propuestas elegidas. */
  averageSavings: number | null;
}

/** Uso por mes desde `from` (YYYY-MM-DD), el más reciente primero. */
export async function studyMetrics(
  client: Pick<Client, "execute">,
  from: string,
): Promise<StudyMonthMetrics[]> {
  const { rows } = await client.execute({
    sql: `SELECT substr(s.created_at, 1, 7) AS month,
        COUNT(*) AS analyses,
        SUM(s.status = 'closed') AS completed,
        SUM(s.status = 'closed' AND (c.tramite_id IS NOT NULL OR c.status = 'processed')) AS in_tramite,
        SUM(COALESCE(s.ai_cost_usd, 0)) AS ai_cost_usd,
        AVG(CASE WHEN s.status = 'closed' THEN s.savings END) AS average_savings
      FROM comparison_studies s
      LEFT JOIN comparativas c ON c.id = s.comparativa_id
      WHERE s.created_at >= ?
      GROUP BY month
      ORDER BY month DESC`,
    args: [from],
  });
  return rows.map((row) => ({
    month: String(row.month),
    analyses: Number(row.analyses ?? 0),
    completed: Number(row.completed ?? 0),
    inTramite: Number(row.in_tramite ?? 0),
    aiCostUsd: Math.round(Number(row.ai_cost_usd ?? 0) * 10000) / 10000,
    averageSavings:
      row.average_savings === null || row.average_savings === undefined
        ? null
        : Math.round(Number(row.average_savings) * 100) / 100,
  }));
}
