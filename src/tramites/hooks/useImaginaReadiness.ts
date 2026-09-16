import { useEffect, useState } from "react";
import type { ImaginaMissingField } from "@/tramites/utils/imagina-missing-fields";

export interface ImaginaReadiness {
  configured: boolean;
  required: string[];
  missing: ImaginaMissingField[];
}

// Qué falta para poder enviar el contrato a Imagina. `refreshKey` fuerza una
// recarga (p. ej. tras guardar datos del cliente o del contrato).
export function useImaginaReadiness({
  tramiteId,
  contractId,
  enabled = true,
  refreshKey,
}: {
  tramiteId: string;
  contractId?: string | null;
  enabled?: boolean;
  refreshKey?: unknown;
}) {
  const [readiness, setReadiness] = useState<ImaginaReadiness | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();
    const load = async () => {
      try {
        const params = new URLSearchParams({ tramite_id: tramiteId });
        if (contractId) params.set("contract_id", contractId);
        const response = await fetch(
          `/api/v2/integrations/imagina-energia/contracts/readiness?${params}`,
          { signal: controller.signal },
        );
        const result = (await response.json()) as {
          success?: boolean;
          error?: string;
          data?: Partial<ImaginaReadiness>;
        };
        if (!result.success || !result.data) {
          throw new Error(result.error || "No se ha podido comprobar los datos");
        }
        setReadiness({
          configured: Boolean(result.data.configured),
          required: result.data.required ?? [],
          missing: result.data.missing ?? [],
        });
        setError(null);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setReadiness(null);
        setError(err instanceof Error ? err.message : String(err));
      }
    };

    load();
    return () => controller.abort();
  }, [contractId, enabled, refreshKey, tramiteId]);

  return { readiness, error };
}
