import type { Client } from "@libsql/client";
import { randomUUID } from "node:crypto";
import { getTursoControlClient } from "@/core/libsql/client";

export type AiJobType =
  | "invoice_extraction"
  | "rate_extraction"
  | "classification";

export interface AiJobContext {
  tenantSlug: string;
  jobType: AiJobType;
  userId?: string;
  /** Comparativa, ingesta u otro objeto al que se imputa la llamada. */
  subjectId?: string;
}

export interface AiUsageEvent {
  context: AiJobContext;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  costUsd: number | null;
  generationId: string | null;
  succeeded: boolean;
  error: string | null;
}

export type RecordAiUsage = (event: AiUsageEvent) => Promise<void>;

type QueryClient = Pick<Client, "execute">;

/**
 * Guarda una fila por llamada en la base de control. Nunca hace fallar la
 * llamada a la IA: si el registro falla, se informa y se sigue.
 */
export async function recordAiUsage(
  event: AiUsageEvent,
  client: QueryClient = getTursoControlClient(),
): Promise<void> {
  try {
    await client.execute({
      sql: `INSERT INTO ai_usage_events (
          id, tenant_slug, job_type, model, subject_id, user_id,
          input_tokens, output_tokens, total_tokens, cost_usd,
          generation_id, succeeded, error
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        randomUUID(),
        event.context.tenantSlug,
        event.context.jobType,
        event.model,
        event.context.subjectId ?? null,
        event.context.userId ?? null,
        event.inputTokens,
        event.outputTokens,
        event.totalTokens,
        event.costUsd,
        event.generationId,
        event.succeeded ? 1 : 0,
        event.error,
      ],
    });
  } catch (error) {
    console.error("[ai-usage] could not record usage", {
      tenantSlug: event.context.tenantSlug,
      jobType: event.context.jobType,
      error,
    });
  }
}
