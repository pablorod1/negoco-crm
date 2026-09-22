import type {
  ImaginaContractCallback,
  ImaginaContractChangeWebhook,
  ImaginaContractInfo,
} from "./schemas";

export type NegocoImaginaStatus =
  | "Pendiente de Firma"
  | "Procesando"
  | "Activo"
  | "Scoring"
  | "Incidencia"
  | "KO";

export type ImaginaOutcomePhase =
  | "submission"
  | "scoring"
  | "contract"
  | "signature"
  | "processing"
  | "activation";

export type ImaginaRecoveryAction =
  | "retry_submission"
  | "send_signature"
  | "resend_signature"
  | "sync"
  | "manual_review"
  | "none";

export interface ImaginaStateInput {
  estadoId?: number | null;
  subestadoId?: number | null;
  estadoDescripcion?: string | null;
  subestadoDescripcion?: string | null;
}

export interface ImaginaStatusMapping {
  status: NegocoImaginaStatus | null;
  reason: string;
  terminal: boolean;
  code: string;
  phase: ImaginaOutcomePhase;
  message: string;
  recoveryAction: ImaginaRecoveryAction;
}

const normalize = (value?: string | null): string =>
  (value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

const hasAnyText = (haystack: string, needles: string[]): boolean =>
  needles.some((needle) => haystack.includes(needle));

const readableError = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (!value || typeof value !== "object") return null;

  for (const key of ["error", "message", "detail", "description"]) {
    const candidate = (value as Record<string, unknown>)[key];
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
};

export const mapImaginaStateToNegoco = (
  input: ImaginaStateInput,
): ImaginaStatusMapping => {
  const estadoText = normalize(input.estadoDescripcion);
  const subestadoText = normalize(input.subestadoDescripcion);
  const combinedText = `${estadoText} ${subestadoText}`;
  const estadoId = input.estadoId ?? undefined;
  const subestadoId = input.subestadoId ?? undefined;

  if (estadoId === 4 && subestadoId === 24) {
    return {
      status: "Scoring",
      reason: "Imagina rechazó el scoring del contrato",
      terminal: true,
      code: "SCORING_DENIED",
      phase: "scoring",
      message: input.subestadoDescripcion || "Scoring rechazado por Imagina.",
      recoveryAction: "none",
    };
  }

  if (
    subestadoId === 16 ||
    estadoId === 4 ||
    hasAnyText(combinedText, ["firma rechazada", "anulado", "cancelado"])
  ) {
    return {
      status: "KO",
      reason: "Imagina canceló definitivamente el contrato o rechazó la firma",
      terminal: true,
      code: "CONTRACT_CANCELLED",
      phase: "processing",
      message:
        input.subestadoDescripcion ||
        input.estadoDescripcion ||
        "Contrato cancelado definitivamente por Imagina.",
      recoveryAction: "none",
    };
  }

  if (
    (estadoId === 3 && subestadoId === 9) ||
    (estadoText === "activo" && subestadoText === "activo")
  ) {
    return {
      status: "Activo",
      reason: "Imagina confirmó la activación del contrato",
      terminal: true,
      code: "CONTRACT_ACTIVE",
      phase: "activation",
      message: "Contrato activo en Imagina Energía.",
      recoveryAction: "none",
    };
  }

  if (
    subestadoId === 6 ||
    subestadoId === 28 ||
    subestadoId === 31 ||
    hasAnyText(combinedText, ["incidencia"])
  ) {
    return {
      status: "Incidencia",
      reason: "Imagina comunicó una incidencia recuperable",
      terminal: false,
      code: "PROVIDER_INCIDENT",
      phase: "processing",
      message:
        input.subestadoDescripcion ||
        input.estadoDescripcion ||
        "Incidencia operativa comunicada por Imagina.",
      recoveryAction: "sync",
    };
  }

  if (estadoId === 1 && subestadoId === 1) {
    return {
      status: "Pendiente de Firma",
      reason: "El contrato está pendiente de firma en Imagina",
      terminal: false,
      code: "SIGNATURE_PENDING",
      phase: "signature",
      message: "La firma está pendiente de completar por el cliente.",
      recoveryAction: "sync",
    };
  }

  if (
    (estadoId === 1 && subestadoId === 50) ||
    subestadoText === "firmado" ||
    estadoId === 2 ||
    hasAnyText(combinedText, [
      "firmado",
      "activable",
      "solicitado",
      "aceptado",
      "pendiente de solicitud",
    ])
  ) {
    return {
      status: "Procesando",
      reason: "Imagina está procesando el contrato firmado",
      terminal: false,
      code: "CONTRACT_PROCESSING",
      phase: "processing",
      message:
        input.subestadoDescripcion ||
        "Contrato firmado y en proceso de activación.",
      recoveryAction: "sync",
    };
  }

  return {
    status: null,
    reason: "Imagina comunicó un estado todavía no mapeado",
    terminal: false,
    code: "UNMAPPED_PROVIDER_STATE",
    phase: "processing",
    message:
      input.subestadoDescripcion ||
      input.estadoDescripcion ||
      "Estado de Imagina pendiente de clasificación.",
    recoveryAction: "sync",
  };
};

export const mapContractInfoToNegoco = (
  contract: ImaginaContractInfo,
): ImaginaStatusMapping =>
  mapImaginaStateToNegoco({
    estadoId: contract.estado?.id ?? null,
    subestadoId: contract.subestado?.id ?? null,
    estadoDescripcion: contract.estado?.descripcion ?? contract.estado?.estado,
    subestadoDescripcion:
      contract.subestado?.descripcion ?? contract.subestado?.subestado,
  });

export const mapChangeWebhookToNegoco = (
  webhook: ImaginaContractChangeWebhook,
): ImaginaStatusMapping => {
  const cambios = webhook.cambios ?? [];
  const estadoChange = cambios.find(
    (change) =>
      normalize(change.campo) === "estado" ||
      normalize(change.campo_tecnico) === "id_estado",
  );
  const subestadoChange = cambios.find(
    (change) =>
      normalize(change.campo) === "subestado" ||
      normalize(change.campo_tecnico) === "id_subestado",
  );

  return mapImaginaStateToNegoco({
    estadoId:
      typeof estadoChange?.valor_nuevo === "number"
        ? estadoChange.valor_nuevo
        : undefined,
    subestadoId:
      typeof subestadoChange?.valor_nuevo === "number"
        ? subestadoChange.valor_nuevo
        : undefined,
    estadoDescripcion: estadoChange?.descripcion_nueva,
    subestadoDescripcion: subestadoChange?.descripcion_nueva,
  });
};

export const mapContractCallbackToNegoco = (
  callback: ImaginaContractCallback,
): ImaginaStatusMapping => {
  const creditCode = callback.credit_result?.result_code ?? null;
  const creditText = normalize(callback.credit_result?.result_operation);
  if (creditCode === 3 || creditText.includes("denegado")) {
    return {
      status: "Scoring",
      reason: "Imagina rechazó el scoring durante la contratación",
      terminal: true,
      code: "SCORING_DENIED",
      phase: "scoring",
      message:
        callback.credit_result?.result_operation ||
        "Scoring denegado por Imagina.",
      recoveryAction: "none",
    };
  }

  const contractOk =
    normalize(callback.contrato_result?.result_operation) === "ok" ||
    Boolean(callback.contrato_result?.content?.id);
  const manualReview =
    creditCode === 2 || creditCode === 4 || creditText.includes("revision manual");
  if (manualReview && !contractOk) {
    return {
      status: "Incidencia",
      reason: "El scoring de Imagina requiere revisión manual",
      terminal: false,
      code: "SCORING_MANUAL_REVIEW",
      phase: "scoring",
      message:
        callback.credit_result?.result_operation ||
        "Imagina ha enviado el scoring a revisión manual.",
      recoveryAction: "manual_review",
    };
  }

  if (!contractOk) {
    return {
      status: "Incidencia",
      reason: "Imagina no pudo crear el contrato",
      terminal: false,
      code: callback.error ? "SUBMISSION_ERROR" : "CONTRACT_NOT_CREATED",
      phase: callback.error ? "submission" : "contract",
      message:
        readableError(callback.error) ||
        callback.contrato_result?.result_operation ||
        "Imagina no confirmó la creación del contrato.",
      recoveryAction: "retry_submission",
    };
  }

  const firmaText = normalize(
    callback.firma_result?.result_operation ||
      callback.firma_result?.status ||
      callback.firma_result?.message,
  );
  const firmaSent =
    callback.firma_result?.result_code === 1 ||
    firmaText.includes("success") ||
    firmaText.includes("enviado") ||
    firmaText.includes("firma digital");

  if (firmaSent) {
    return {
      status: "Pendiente de Firma",
      reason: "Contrato creado y firma enviada por Imagina",
      terminal: false,
      code: "SIGNATURE_SENT",
      phase: "signature",
      message: "Contrato creado; la firma se ha enviado al cliente.",
      recoveryAction: "sync",
    };
  }

  return {
    status: "Incidencia",
    reason: "El contrato se creó, pero Imagina no pudo enviar la firma",
    terminal: false,
    code: "SIGNATURE_FAILED",
    phase: "signature",
    message:
      callback.firma_result?.result_operation ||
      callback.firma_result?.message ||
      callback.firma_result?.status ||
      "Imagina no confirmó el envío de la firma.",
    recoveryAction: callback.firma_result?.circuito_id
      ? "resend_signature"
      : "send_signature",
  };
};

export const mapScoringCodeToNegoco = (
  code?: number | null,
  detail?: string | null,
): ImaginaStatusMapping => {
  if (code === 3) {
    return {
      status: "Scoring",
      reason: "Imagina rechazó el scoring",
      terminal: true,
      code: "SCORING_DENIED",
      phase: "scoring",
      message: detail || "Scoring denegado por Imagina.",
      recoveryAction: "none",
    };
  }

  if (code === 2 || code === 4) {
    return {
      status: "Incidencia",
      reason: "El scoring de Imagina requiere revisión manual",
      terminal: false,
      code: "SCORING_MANUAL_REVIEW",
      phase: "scoring",
      message: detail || "El scoring requiere una revisión manual.",
      recoveryAction: "manual_review",
    };
  }

  if (code == null && detail) {
    return {
      status: "Incidencia",
      reason: "Imagina no pudo completar el scoring",
      terminal: false,
      code: "SCORING_ERROR",
      phase: "scoring",
      message: detail,
      recoveryAction: "manual_review",
    };
  }

  return {
    status: null,
    reason: "Imagina aprobó el scoring",
    terminal: false,
    code: "SCORING_APPROVED",
    phase: "scoring",
    message: detail || "Scoring aprobado por Imagina.",
    recoveryAction: "none",
  };
};
