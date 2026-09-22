import { useEffect, useState } from "react";

export interface ImaginaSubmissionRef {
  contract_id: string;
  tramite_id: string;
  external_contract_id: string | null;
  external_contract_code: string | null;
  external_reference: string | null;
  request_id: string | null;
  status: string | null;
  substatus: string | null;
  synced_at: string | null;
  outcome_code: string | null;
  outcome_phase:
    | "submission"
    | "scoring"
    | "contract"
    | "signature"
    | "processing"
    | "activation"
    | null;
  outcome_message: string | null;
  recovery_action:
    | "retry_submission"
    | "send_signature"
    | "resend_signature"
    | "sync"
    | "manual_review"
    | "none"
    | null;
  outcome_terminal: boolean;
  circuito_id: string | null;
}

export interface ImaginaIntegrationState {
  enabled: boolean;
  configured: boolean;
  // Última referencia del contrato en Imagina, si ya se envió alguna vez.
  submission: ImaginaSubmissionRef | null;
}

const DISABLED: ImaginaIntegrationState = {
  enabled: false,
  configured: false,
  submission: null,
};

// Estado de la integración del tenant y, opcionalmente, si el contrato
// indicado ya fue enviado. `enabled=false` evita la petición (p. ej. hasta
// que se abre el modal).
export function useImaginaIntegrationStatus({
  contractId,
  enabled = true,
  refreshKey,
}: {
  contractId?: string | null;
  enabled?: boolean;
  refreshKey?: unknown;
}) {
  const [state, setState] = useState<ImaginaIntegrationState | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (contractId) params.set("contract_id", contractId);
        const query = params.toString();
        const response = await fetch(
          `/api/v2/integrations/imagina-energia/status${query ? `?${query}` : ""}`,
          { signal: controller.signal },
        );
        if (!response.ok) {
          throw new Error("No se pudo consultar el estado de Imagina");
        }
        const result = (await response.json()) as {
          success?: boolean;
          data?: Partial<ImaginaIntegrationState>;
        };
        setState(
          result.success && result.data
            ? {
                enabled: Boolean(result.data.enabled),
                configured: Boolean(result.data.configured),
                submission: result.data.submission ?? null,
              }
            : DISABLED,
        );
      } catch (error) {
        if ((error as Error).name !== "AbortError") setState(DISABLED);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    load();
    return () => controller.abort();
  }, [contractId, enabled, refreshKey]);

  return { integration: state, loading };
}
