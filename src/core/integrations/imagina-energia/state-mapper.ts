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
}

const normalize = (value?: string | null): string =>
  (value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

const hasAnyText = (haystack: string, needles: string[]): boolean =>
  needles.some((needle) => haystack.includes(needle));

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
      reason: "Imagina scoring rejected",
      terminal: true,
    };
  }

  if (
    subestadoId === 16 ||
    estadoId === 4 ||
    hasAnyText(combinedText, ["firma rechazada", "anulado", "cancelado"])
  ) {
    return {
      status: "KO",
      reason: "Imagina definitive cancellation or rejected signature",
      terminal: true,
    };
  }

  if (
    (estadoId === 3 && subestadoId === 9) ||
    (estadoText === "activo" && subestadoText === "activo")
  ) {
    return {
      status: "Activo",
      reason: "Imagina contract active",
      terminal: true,
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
      reason: "Imagina recoverable incident",
      terminal: false,
    };
  }

  if (estadoId === 1 && subestadoId === 1) {
    return {
      status: "Pendiente de Firma",
      reason: "Imagina pending signature",
      terminal: false,
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
      reason: "Imagina signed or in distributor processing",
      terminal: false,
    };
  }

  return {
    status: null,
    reason: "No mapped Imagina state",
    terminal: false,
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
      reason: "Contract callback scoring denied",
      terminal: true,
    };
  }

  const contractOk =
    normalize(callback.contrato_result?.result_operation) === "ok" ||
    Boolean(callback.contrato_result?.content?.id);
  if (!contractOk) {
    return {
      status: "Incidencia",
      reason: "Contract callback did not create contract",
      terminal: false,
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
      reason: "Contract created and signature sent",
      terminal: false,
    };
  }

  return {
    status: "Incidencia",
    reason: "Contract created but signature was not confirmed as sent",
    terminal: false,
  };
};

export const mapScoringCodeToNegoco = (
  code?: number | null,
): ImaginaStatusMapping => {
  if (code === 3) {
    return {
      status: "Scoring",
      reason: "Scoring denied",
      terminal: true,
    };
  }

  if (code === 2 || code === 4) {
    return {
      status: "Incidencia",
      reason: "Scoring requires manual review",
      terminal: false,
    };
  }

  return {
    status: null,
    reason: "Scoring approved or not actionable",
    terminal: false,
  };
};
