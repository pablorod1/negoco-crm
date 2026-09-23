"use client";

import { Loader2, RefreshCw, Signature } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { cn } from "@/core/utils";
import { formatDateTime } from "@/core/utils/format";
import type { ImaginaSubmissionRef } from "@/tramites/hooks/useImaginaIntegrationStatus";

const PHASE_LABELS = {
  submission: "Envío",
  scoring: "Scoring",
  contract: "Creación del contrato",
  signature: "Firma",
  processing: "Tramitación",
  activation: "Activación",
} as const;

const displayOutcomeMessage = (
  message: string | null,
  recoveryAction: ImaginaSubmissionRef["recovery_action"],
): string => {
  if (!message) {
    return "La solicitud está enviada y pendiente de respuesta de Imagina.";
  }

  // El callback conserva el error original para soporte, pero la respuesta de
  // Imagina puede incluir trazas de su servidor que no ayudan al usuario.
  if (/traceback|unexpected keyword argument|\btypeerror:/i.test(message)) {
    const explanation = /credit[\s_-]?check|awscredit/i.test(message)
      ? "Imagina no ha podido completar la comprobación de solvencia por un error técnico."
      : "Imagina no ha podido completar la operación por un error técnico.";
    return recoveryAction === "retry_submission"
      ? `${explanation} Imagina debe corregirlo; cuando confirme que está resuelto, podrás reenviar el contrato.`
      : `${explanation} El equipo de Imagina debe revisarlo.`;
  }

  return message;
};

interface Props {
  submission: ImaginaSubmissionRef;
  actionInProgress: "signature" | "sync" | null;
  onAction: (action: "signature" | "sync") => void;
}

export default function ImaginaIntegrationPanel({
  submission,
  actionInProgress,
  onAction,
}: Props) {
  const alreadyCreated = Boolean(submission.external_contract_id);
  const recoveryAction = submission.recovery_action;

  return (
    <div className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Seguimiento de Imagina
          </p>
          <p className="mt-1 text-sm font-medium text-gray-900">
            {submission.outcome_phase
              ? PHASE_LABELS[submission.outcome_phase]
              : alreadyCreated
                ? "Contrato creado"
                : "Solicitud enviada"}
          </p>
        </div>
        {submission.outcome_terminal ? (
          <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-medium text-gray-700">
            Final
          </span>
        ) : null}
      </div>

      <p className="text-xs leading-relaxed text-gray-700">
        {displayOutcomeMessage(submission.outcome_message, recoveryAction)}
      </p>

      {submission.status || submission.substatus ? (
        <dl className="grid grid-cols-2 gap-2 text-xs">
          {submission.status ? (
            <div>
              <dt className="text-gray-400">Estado Imagina</dt>
              <dd className="font-medium text-gray-700">{submission.status}</dd>
            </div>
          ) : null}
          {submission.substatus ? (
            <div>
              <dt className="text-gray-400">Subestado</dt>
              <dd className="font-medium text-gray-700">
                {submission.substatus}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      <details className="text-xs text-gray-500">
        <summary className="cursor-pointer select-none">Datos técnicos</summary>
        <div className="mt-2 space-y-1 break-all">
          {submission.external_contract_code ? (
            <p>Contrato: {submission.external_contract_code}</p>
          ) : null}
          {submission.external_reference ? (
            <p>Referencia: {submission.external_reference}</p>
          ) : null}
          {submission.request_id ? (
            <p>Solicitud: {submission.request_id}</p>
          ) : null}
          {submission.synced_at ? (
            <p>Actualizado: {formatDateTime(submission.synced_at)}</p>
          ) : null}
        </div>
      </details>

      {recoveryAction === "manual_review" ? (
        <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-800">
          Requiere revisión manual. No se reenviará automáticamente para evitar
          solicitudes duplicadas.
        </p>
      ) : null}

      {(recoveryAction === "send_signature" ||
        recoveryAction === "resend_signature") &&
      alreadyCreated ? (
        <Button
          variant="outline"
          onClick={() => onAction("signature")}
          disabled={actionInProgress !== null}
        >
          {actionInProgress === "signature" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Signature size={16} />
          )}
          {recoveryAction === "resend_signature"
            ? "Reenviar firma"
            : "Enviar firma"}
        </Button>
      ) : null}

      {recoveryAction === "sync" && alreadyCreated ? (
        <Button
          variant="outline"
          onClick={() => onAction("sync")}
          disabled={actionInProgress !== null}
        >
          <RefreshCw
            className={cn(
              "size-4",
              actionInProgress === "sync" && "animate-spin",
            )}
          />
          Sincronizar con Imagina
        </Button>
      ) : null}
    </div>
  );
}
