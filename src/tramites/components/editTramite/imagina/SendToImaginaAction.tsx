"use client";
import { useMemo, useState } from "react";
import {
  AlertCircleIcon,
  CheckSquare,
  CircleCheck,
  CircleX,
  Loader2,
  SendHorizontal,
} from "lucide-react";
import { Button } from "@/core/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/core/components/ui/dialog";
import LoadingStateModal from "@/core/components/LoadingStateModal";
import { showCustomToast } from "@/core/components/CustomToast";
import { getStatusBadge } from "@/core/hooks/use-status-badge";
import { formatDate, formatUUID } from "@/core/utils/format";
import type { User } from "@/core/types";
import type {
  ClientDB,
  ContractDB,
  SignerDB,
  Status,
  TramiteVM,
} from "@/tramites/types";
import { SENT_TO_SUPPLIER_STATUS } from "@/tramites/constants";
import { useActiveEnergySuppliers } from "@/comercializadoras/hooks/useActiveEnergySuppliers";
import { useImaginaIntegrationStatus } from "@/tramites/hooks/useImaginaIntegrationStatus";
import { findImaginaContract } from "@/tramites/utils/imagina-contract";
import {
  formatImaginaMissing,
  type ImaginaMissingField,
} from "@/tramites/utils/imagina-missing-fields";
import { notifyTramiteStatusChange } from "@/tramites/utils/notify-status-change";
import ImaginaMissingFieldsForm from "./ImaginaMissingFieldsForm";

interface Props {
  tramite: TramiteVM;
  client: ClientDB;
  contracts: ContractDB[];
  signer?: SignerDB | null;
  userData: User;
  onUpdate: () => void | Promise<void>;
}

type ImaginaCheck =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "ok" }
  | { status: "missing"; missing: ImaginaMissingField[] }
  | { status: "error"; error: string };

// Envío (o reintento) a Imagina Energía desde las acciones del trámite, sin
// pasar por un cambio de estado. Solo tiene sentido en "Verificado": antes no
// está listo y después ya se ha enviado.
export default function SendToImaginaAction({
  tramite,
  client,
  contracts,
  signer,
  userData,
  onUpdate,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [check, setCheck] = useState<ImaginaCheck>({ status: "idle" });
  const [refreshKey, setRefreshKey] = useState(0);

  const { activeSuppliers } = useActiveEnergySuppliers();
  const imaginaContract = useMemo(
    () => findImaginaContract(contracts, activeSuppliers),
    [activeSuppliers, contracts],
  );

  const canSend =
    tramite.status === "Verificado" &&
    (userData.role === "admin" || userData.role === "1") &&
    Boolean(imaginaContract);

  const { integration } = useImaginaIntegrationStatus({
    contractId: imaginaContract?.id,
    enabled: canSend,
    refreshKey,
  });

  const previousSubmission = integration?.submission ?? null;
  const alreadyCreated = Boolean(previousSubmission?.external_contract_id);

  if (
    !canSend ||
    !imaginaContract ||
    !integration?.enabled ||
    !integration.configured ||
    alreadyCreated
  ) {
    return null;
  }

  const isRetry = Boolean(previousSubmission);

  const runPreflight = async (): Promise<boolean> => {
    setCheck({ status: "checking" });
    try {
      const response = await fetch(
        "/api/v2/integrations/imagina-energia/contracts/preflight",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tramite_id: tramite.id,
            contract_id: imaginaContract.id,
          }),
        },
      );
      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
        missing?: ImaginaMissingField[];
      };
      if (result.success) {
        setCheck({ status: "ok" });
        return true;
      }
      setCheck(
        result.missing?.length
          ? { status: "missing", missing: result.missing }
          : {
              status: "error",
              error: result.error || "No se han podido validar los datos.",
            },
      );
      return false;
    } catch (error) {
      setCheck({
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  };

  // Al abrir se validan los datos: si falta algo, el formulario aparece ya.
  const onOpen = () => {
    setRefreshKey((key) => key + 1);
    setIsOpen(true);
    void runPreflight();
  };
  const onClose = () => setIsOpen(false);

  const handleFieldsSaved = async () => {
    await onUpdate();
    await runPreflight();
  };

  const handleSend = async () => {
    setLoading(true);
    try {
      if (!(await runPreflight())) {
        showCustomToast({
          title: "Faltan datos para Imagina",
          message:
            "Completa y guarda los campos marcados antes de enviar.",
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: CircleX,
        });
        return;
      }

      const submitRes = await fetch(
        "/api/v2/integrations/imagina-energia/contracts/submit",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tramite_id: tramite.id,
            contract_id: imaginaContract.id,
            user_id: userData.id,
          }),
        },
      );
      const submitResult = (await submitRes.json()) as {
        success?: boolean;
        error?: string;
        missing?: ImaginaMissingField[];
        data?: { status?: string | null };
      };

      if (!submitResult.success) {
        showCustomToast({
          title: "Imagina no enviado",
          message:
            formatImaginaMissing(submitResult.missing) ||
            submitResult.error ||
            "No se ha podido enviar el contrato a Imagina Energía.",
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: CircleX,
        });
        return;
      }

      const newStatus =
        (submitResult.data?.status as Status | null | undefined) ||
        tramite.status;
      const notified = await notifyTramiteStatusChange({
        tramite,
        client,
        userData,
        oldStatus: tramite.status,
        newStatus,
      });

      if (!notified.success) {
        showCustomToast({
          title:
            notified.step === "email"
              ? "Error al enviar notificación por email"
              : "Error al enviar notificación",
          message: notified.error as string,
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: CircleX,
        });
      }

      showCustomToast({
        title: "Contrato enviado a Imagina Energía",
        message:
          newStatus === SENT_TO_SUPPLIER_STATUS
            ? `El trámite ha pasado a "${SENT_TO_SUPPLIER_STATUS}".`
            : "Imagina Energía ha aceptado la solicitud.",
        iconColor: "var(--success-color)",
        iconSize: 24,
        icon: CheckSquare,
      });
      onClose();
      onUpdate();
    } catch (error) {
      console.error(error);
      showCustomToast({
        title: "Error al enviar a Imagina Energía",
        message: error instanceof Error ? error.message : String(error),
        iconColor: "var(--danger-color)",
        iconSize: 24,
        icon: CircleX,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button variant="outline" onClick={onOpen}>
        <SendHorizontal size={16} />
        {isRetry ? "Reenviar a Imagina Energía" : "Enviar a Imagina Energía"}
      </Button>

      <Dialog open={isOpen} modal>
        <DialogContent className="[&>button]:hidden overflow-auto max-h-[90vh]">
          <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center space-x-2">
              <DialogTitle className="text-xl font-semibold text-primary">
                Enviar a Imagina Energía
              </DialogTitle>
              <DialogDescription>
                <span className="text-xs text-primary-400">
                  #{formatUUID(tramite.id)}
                </span>
              </DialogDescription>
            </div>
            {getStatusBadge(tramite.status, "general")}
          </DialogHeader>

          {loading && (
            <LoadingStateModal
              title="Enviando a Imagina Energía..."
              description="Validando los datos y enviando el contrato."
            />
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-md bg-primary-50 p-3 text-sm">
              <div>
                <p className="text-xs text-primary-500">Contrato</p>
                <p className="font-medium">#{formatUUID(imaginaContract.id)}</p>
              </div>
              <div>
                <p className="text-xs text-primary-500">CUPS</p>
                <p className="font-medium break-all">
                  {imaginaContract.CUPS || "—"}
                </p>
              </div>
            </div>

            <p className="text-sm text-gray-600">
              Se validarán los datos del cliente y del contrato y se enviará la
              solicitud a Imagina Energía. Si se acepta, el trámite pasará a{" "}
              <span className="font-medium">{SENT_TO_SUPPLIER_STATUS}</span>.
            </p>

            {previousSubmission ? (
              <div className="flex items-start space-x-2 rounded-md bg-yellow-50 p-3">
                <AlertCircleIcon className="h-5 w-5 flex-shrink-0 text-yellow-500" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">
                    Ya se intentó enviar este contrato
                  </p>
                  <p className="text-xs text-yellow-600">
                    Último intento
                    {previousSubmission.synced_at
                      ? ` el ${formatDate(previousSubmission.synced_at)}`
                      : ""}
                    {previousSubmission.external_reference
                      ? ` (ref. ${previousSubmission.external_reference})`
                      : ""}
                    . Imagina no ha confirmado la creación del contrato;
                    reenviar generará una nueva solicitud.
                  </p>
                </div>
              </div>
            ) : null}

            {check.status === "checking" ? (
              <p className="flex items-center gap-2 text-xs text-primary-500">
                <Loader2 className="size-3.5 animate-spin" />
                Comprobando los datos para Imagina Energía…
              </p>
            ) : null}
            {check.status === "ok" ? (
              <p className="flex items-center gap-2 rounded-md border border-success-400 bg-success-50 p-2 text-xs text-success-600">
                <CircleCheck className="size-4" />
                Datos completos: listo para enviar.
              </p>
            ) : null}
            {check.status === "error" ? (
              <p className="rounded-md border border-danger-400 bg-danger-50 p-2 text-xs text-danger">
                {check.error}
              </p>
            ) : null}
            {check.status === "missing" ? (
              <ImaginaMissingFieldsForm
                missing={check.missing}
                tramiteId={tramite.id}
                client={client}
                contract={imaginaContract}
                signer={signer}
                userData={userData}
                onSaved={handleFieldsSaved}
                disabled={loading}
              />
            ) : null}
          </div>

          <DialogFooter>
            <div className="flex w-full items-center justify-end gap-3">
              <Button variant="outline" onClick={onClose} disabled={loading}>
                Cancelar
              </Button>
              <Button
                onClick={handleSend}
                disabled={loading || check.status !== "ok"}
              >
                {loading
                  ? "Enviando..."
                  : isRetry
                    ? "Reenviar"
                    : "Enviar"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
