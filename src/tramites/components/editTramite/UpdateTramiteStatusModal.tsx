"use client";
import ButtonGroupComponent from "@/core/components/ButtonGroupComponent";
import { User } from "@/core/types";
import {
  ClientDB,
  ContractDB,
  LiquidezStatus,
  SignerDB,
  Status,
  TramiteVM,
} from "@/tramites/types";
import { getStatusBadge } from "@/core/hooks/use-status-badge";

import {
  InputComponent,
  SelectComponent,
} from "../createTramite/InputComponent";
import {
  BAJA_LIQUIDEZ_STATUS,
  COMERCIAL_STATUS_TYPES,
  PLAIN_LIQUIDEZ_STATUS,
  PLAIN_STATUS_TYPES,
  SENT_TO_SUPPLIER_STATUS,
} from "@/tramites/constants";
import { NOW_DATE, RENOVATION_DATE } from "@/dashboard/constants";
import { useState, useEffect, useMemo } from "react";
import {
  CalendarIcon,
  AlertCircleIcon,
  Coins,
  CircleX,
  CheckSquare,
  CircleCheck,
  Loader2,
} from "lucide-react";
import { formatDate, formatUUID } from "@/core/utils/format";
import { showCustomToast } from "@/core/components/CustomToast";
import { Textarea } from "@/core/components/ui/textarea";
import { Checkbox } from "@/core/components/ui/checkbox";
import { Switch } from "@/core/components/ui/switch";
import LoadingStateModal from "@/core/components/LoadingStateModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogDescription,
} from "@/core/components/ui/dialog";
import { DatePicker } from "@/core/components/DatePicker";
import { Separator } from "@/core/components/ui/separator";
import { Label } from "@/core/components/ui/label";
import { Button } from "@/core/components/ui/button";
import TooltipComponent from "@/core/components/TooltipComponent";
import { useActiveEnergySuppliers } from "@/comercializadoras/hooks/useActiveEnergySuppliers";
import { useUserCompanyCommissions } from "@/core/hooks/use-user-company-commissions";
import { calculateSalesPersonCommission } from "@/core/utils/sales-commission";
import { useImaginaIntegrationStatus } from "@/tramites/hooks/useImaginaIntegrationStatus";
import { findImaginaContract } from "@/tramites/utils/imagina-contract";
import {
  formatImaginaMissing,
  type ImaginaMissingField,
} from "@/tramites/utils/imagina-missing-fields";
import { notifyTramiteStatusChange } from "@/tramites/utils/notify-status-change";
import ImaginaMissingFieldsForm from "./imagina/ImaginaMissingFieldsForm";

interface Props {
  tramite: TramiteVM;
  userData: User;
  onUpdate: () => void | Promise<void>;
  client: ClientDB;
  contracts: ContractDB[];
  signer?: SignerDB | null;
}

type ImaginaCheck =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "ok" }
  | { status: "missing"; missing: ImaginaMissingField[] }
  | { status: "error"; error: string };

interface FormData {
  status: Status;
  liquidez_status: LiquidezStatus;
  comision: number;
  comision_sales_person: number;
  note?: string;
  comisionConfirmed: boolean;
  comisionSalesPersonConfirmed: boolean;
  collection_date: Date | null;
  payment_date: Date | null;
  activation_date: Date | null;
  renovation_date: Date | null;
  tramitation_date: Date | null;
}

const buildInitialFormData = (tramite: TramiteVM): FormData => ({
  status: tramite.status,
  liquidez_status: tramite.liquidez_status,
  comision: tramite.comision,
  comision_sales_person: tramite.comision_sales_person,
  note: "",
  comisionConfirmed: false,
  comisionSalesPersonConfirmed: false,
  collection_date: null,
  payment_date: null,
  activation_date: null,
  renovation_date: null,
  tramitation_date: null,
});

export default function UpdateTramiteStatusModal({
  tramite,
  userData,
  onUpdate,
  client,
  contracts,
  signer,
}: Props) {
  const [formData, setFormData] = useState<FormData>(() =>
    buildInitialFormData(tramite),
  );
  const [isOpen, setIsOpen] = useState(false);
  const [salesCommissionTouched, setSalesCommissionTouched] = useState(false);
  const { activeSuppliers } = useActiveEnergySuppliers();
  const { commissions: userCompanyCommissions } = useUserCompanyCommissions(
    tramite.user_id,
  );

  const isComercial = userData && userData.role === "2";
  const isTramitable = formData.status === "Tramitable";
  const isBorrador = formData.status === "Borrador";
  const isBaja = formData.status === "Baja";
  const isActivo = formData.status === "Activo";
  const isVerificado = formData.status === "Verificado";
  const [loading, setLoading] = useState(false);
  const [sendToImagina, setSendToImagina] = useState(false);
  const [imaginaCheck, setImaginaCheck] = useState<ImaginaCheck>({
    status: "idle",
  });

  // Estado para controlar si podemos actualizar
  const [canUpdate, setCanUpdate] = useState(isTramitable || isBorrador);

  const imaginaContract = useMemo(
    () => findImaginaContract(contracts, activeSuppliers),
    [activeSuppliers, contracts],
  );

  const { integration: imaginaStatus } = useImaginaIntegrationStatus({
    contractId: imaginaContract?.id,
    enabled: isOpen,
  });

  const canShowImaginaSwitch =
    isVerificado &&
    Boolean(imaginaContract) &&
    Boolean(imaginaStatus?.enabled && imaginaStatus.configured) &&
    // Si Imagina ya creó el contrato, reenviarlo lo duplicaría.
    !imaginaStatus?.submission?.external_contract_id;

  // El estado "Enviado a comercializadora" no se ofrece en el desplegable,
  // pero si es el actual hay que poder mostrarlo (y mantenerlo).
  const statusItems = useMemo(() => {
    const base = isComercial ? COMERCIAL_STATUS_TYPES : PLAIN_STATUS_TYPES;
    return tramite.status === SENT_TO_SUPPLIER_STATUS
      ? [SENT_TO_SUPPLIER_STATUS, ...base]
      : base;
  }, [isComercial, tramite.status]);

  // Al abrir, partir siempre del trámite actual (puede haber cambiado desde
  // fuera, p. ej. por el envío a Imagina o por un webhook).
  const onOpen = () => {
    setFormData(buildInitialFormData(tramite));
    setSalesCommissionTouched(false);
    setSendToImagina(false);
    setImaginaCheck({ status: "idle" });
    setIsOpen(true);
  };

  // Valida los datos contra el mapper de Imagina sin enviar nada. Se lanza
  // al activar el switch (para mostrar el formulario cuanto antes), tras
  // guardar desde el formulario y como última comprobación al Actualizar.
  const runImaginaPreflight = async (): Promise<boolean> => {
    if (!imaginaContract) return false;
    setImaginaCheck({ status: "checking" });
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
        setImaginaCheck({ status: "ok" });
        return true;
      }
      setImaginaCheck(
        result.missing?.length
          ? { status: "missing", missing: result.missing }
          : {
              status: "error",
              error: result.error || "No se han podido validar los datos.",
            },
      );
      return false;
    } catch (error) {
      setImaginaCheck({
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  };

  const handleSendToImaginaChange = (checked: boolean) => {
    setSendToImagina(checked);
    if (checked) void runImaginaPreflight();
    else setImaginaCheck({ status: "idle" });
  };

  const handleImaginaFieldsSaved = async () => {
    await onUpdate();
    await runImaginaPreflight();
  };

  useEffect(() => {
    if (salesCommissionTouched) return;

    const calculatedCommission = calculateSalesPersonCommission({
      baseCommission: formData.comision,
      supplierId: tramite.provider,
      supplierName: tramite.provider,
      commissions: userCompanyCommissions,
      suppliers: activeSuppliers,
    });

    if (calculatedCommission === null) return;

    setFormData((prev) => {
      if (prev.comision_sales_person === calculatedCommission) return prev;

      return {
        ...prev,
        comision_sales_person: calculatedCommission,
      };
    });
  }, [
    activeSuppliers,
    formData.comision,
    salesCommissionTouched,
    tramite.provider,
    userCompanyCommissions,
  ]);

  // Verificar si necesitamos confirmación de comisiones
  const needsConfirmation =
    tramite.status === "Tramitable" &&
    formData.status !== "Borrador" &&
    formData.status !== "Tramitable" &&
    formData.status !== "Baja" &&
    formData.status !== "Scoring";

  useEffect(() => {
    // Si es comercial o el estado es Tramitable o Borrador, siempre se puede actualizar
    if (isComercial || isTramitable || isBorrador) {
      setCanUpdate(true);
      return;
    }

    // En otro caso, verificar si ambas comisiones están confirmadas
    const bothComisionsConfirmed =
      formData.comisionConfirmed && formData.comisionSalesPersonConfirmed;
    setCanUpdate(bothComisionsConfirmed);
  }, [
    isActivo,
    isBorrador,
    isTramitable,
    formData.comisionConfirmed,
    formData.comisionSalesPersonConfirmed,
    isComercial,
  ]);

  const handleDateChange = (date: Date, name: string) => {
    if (date) {
      setFormData((prev) => ({
        ...prev,
        [name]: date,
        ...(name === "activation_date" && {
          // activation date + 1 year
          renovation_date: new Date(
            date.getFullYear() + 1,
            date.getMonth(),
            date.getDate()
          ),
        }),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: null,
        ...(name === "activation_date" && { renovation_date: null }),
      }));
    }
  };

  const handleChange = (
    e:
      | React.ChangeEvent<HTMLSelectElement>
      | React.ChangeEvent<HTMLInputElement>
      | React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    if (name === "comision_sales_person") setSalesCommissionTouched(true);

    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "comision" || name === "comision_sales_person"
          ? Number(value)
          : value,
    }));
  };

  const handleCheckboxChange = (checked: boolean, name: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: checked,
    }));
  };

  const checkSalesComissionChanges = () => {
    return tramite.comision_sales_person !== formData.comision_sales_person;
  };

  const checkComissionChanges = () => {
    return tramite.comision !== formData.comision;
  };

  const checkEmptyComission = () => {
    return (
      (formData.comision_sales_person === 0 ||
        isNaN(formData.comision_sales_person)) &&
      (formData.comision === 0 || isNaN(formData.comision))
    );
  };

  const onClose = () => {
    setIsOpen(false);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      if (isActivo && checkEmptyComission()) {
        showCustomToast({
          title: "Comisiones sin asignar",
          message:
            "Debes asignar comisiones antes de actualizar el trámite a estado Activo.",
          iconColor: "var(--warning-color)",
          iconSize: 24,
          icon: CircleX,
        });
        return;
      }

      // Si necesita confirmación y no están confirmadas ambas comisiones, mostrar mensaje
      if (needsConfirmation && !canUpdate && !isComercial) {
        showCustomToast({
          title: "Confirmación requerida",
          message:
            "Debes confirmar ambas comisiones antes de actualizar el estado.",
          iconColor: "var(--warning-color)",
          iconSize: 24,
          icon: CircleX,
        });
        return;
      }

      const shouldSendToImagina =
        canShowImaginaSwitch && sendToImagina && Boolean(imaginaContract);

      // Última comprobación antes de tocar el estado: si faltan datos, el
      // formulario del modal los muestra y no se guarda nada.
      if (shouldSendToImagina && !(await runImaginaPreflight())) {
        showCustomToast({
          title: "Faltan datos para Imagina",
          message:
            "Completa y guarda los campos marcados en el modal antes de actualizar.",
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: CircleX,
        });
        return;
      }

      const res = await fetch(`/api/v2/contracts/${tramite.id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: formData.status,
          comision_sales_person: checkSalesComissionChanges()
            ? formData.comision_sales_person
            : undefined,
          comision: checkComissionChanges() ? formData.comision : undefined,
          note: formData.note ? formData.note : undefined,
          notes: formData.note ? tramite.notes : undefined,
          liquidez_status: formData.liquidez_status
            ? formData.liquidez_status
            : undefined,
          user_id: userData.id,
          collection_date: formData.collection_date
            ? formData.collection_date.toISOString()
            : undefined,
          payment_date: formData.payment_date
            ? formData.payment_date.toISOString()
            : undefined,
          activation_date: formData.activation_date
            ? formData.activation_date.toISOString()
            : undefined,
          tramitation_date: formData.tramitation_date
            ? formData.tramitation_date.toISOString()
            : undefined,
          renovation_date: formData.renovation_date
            ? formData.renovation_date.toISOString()
            : undefined,
        }),
      });

      const { success, error } = await res.json();

      if (!success) {
        showCustomToast({
          title: "Error al guardar los cambios",
          message: error as string,
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: CircleX,
        });
        return;
      }

      // A partir de aquí el estado ya está guardado: pase lo que pase con
      // Imagina, el modal se cierra y el trámite se refresca.
      let finalStatus: Status = formData.status;
      let imaginaError: string | null = null;

      if (shouldSendToImagina && imaginaContract) {
        const imaginaRes = await fetch(
          "/api/v2/integrations/imagina-energia/contracts/submit",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              tramite_id: tramite.id,
              contract_id: imaginaContract.id,
              user_id: userData.id,
            }),
          },
        );
        const imaginaResult = (await imaginaRes.json()) as {
          success?: boolean;
          error?: string;
          missing?: ImaginaMissingField[];
          data?: { status?: string | null };
        };

        if (imaginaResult.success) {
          finalStatus =
            (imaginaResult.data?.status as Status | null | undefined) ||
            SENT_TO_SUPPLIER_STATUS;
        } else {
          imaginaError =
            formatImaginaMissing(imaginaResult.missing) ||
            imaginaResult.error ||
            "No se ha podido enviar el contrato a Imagina Energía.";
        }
      }

      const notified = await notifyTramiteStatusChange({
        tramite,
        client,
        userData,
        oldStatus: tramite.status,
        newStatus: finalStatus,
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

      if (imaginaError) {
        showCustomToast({
          title: "Estado guardado; Imagina no enviado",
          message: `${imaginaError}\nPuedes reintentarlo desde "Enviar a Imagina Energía" en las acciones del trámite.`,
          iconColor: "var(--warning-color)",
          iconSize: 24,
          icon: CircleX,
        });
      } else if (notified.success) {
        showCustomToast({
          title: "Cambios guardados",
          message:
            finalStatus === SENT_TO_SUPPLIER_STATUS
              ? `Contrato enviado a Imagina Energía. Se ha notificado a ${tramite.user.name}.`
              : `Los cambios se han guardado correctamente. Se ha notificado a ${tramite.user.name}.`,
          iconColor: "var(--success-color)",
          iconSize: 24,
          icon: CheckSquare,
        });
      }

      onClose();
      onUpdate();
    } catch (error) {
      console.error(error);
      showCustomToast({
        title: "Error al guardar los cambios",
        message: error as string,
        iconColor: "var(--danger-color)",
        iconSize: 24,
        icon: CircleX,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectChange = (value: string, name: string) => {
    setFormData((prev) => {
      if (name === "status") {
        if (value === "Activo") {
          return {
            ...prev,
            status: value as Status,
            liquidez_status: "Pendiente de Cobro",
            comision: Math.abs(prev.comision),
            comision_sales_person: Math.abs(prev.comision_sales_person),
            activation_date: NOW_DATE,
            renovation_date: RENOVATION_DATE,
          };
        } else if (value === "Verificado") {
          return {
            ...prev,
            status: value as Status,
            tramitation_date: NOW_DATE,
          };
        } else if (value === "Baja") {
          return {
            ...prev,
            status: value as Status,
            comision: -prev.comision,
            comision_sales_person: -prev.comision_sales_person,
          };
        } else {
          return {
            ...prev,
            status: value as Status,
          };
        }
      } else if (name === "liquidez_status") {
        if (value === "Cobrado por Comercializadora") {
          return {
            ...prev,
            liquidez_status: value,
            collection_date: NOW_DATE,
          };
        } else if (value === "Pagado al Comercial") {
          return {
            ...prev,
            liquidez_status: value as LiquidezStatus,
            payment_date: NOW_DATE,
          };
        } else {
          return {
            ...prev,
            liquidez_status: value as LiquidezStatus,
          };
        }
      } else {
        return {
          ...prev,
          [name]: value,
        };
      }
    });
  };

  return (
    <Dialog open={isOpen} modal>
      <DialogTrigger asChild>
        <Button variant="outline" onClick={onOpen}>
          Actualizar Estado
        </Button>
      </DialogTrigger>
      <DialogContent className="[&>button]:hidden overflow-auto max-h-[90vh]">
        <DialogHeader
          className="flex flex-row items-center justify-between space-y-0 pb-2"
          aria-describedby="modal-description"
        >
          <div className="flex items-center space-x-2">
            <DialogTitle className="text-xl font-semibold text-primary">
              Actualizar Estado
            </DialogTitle>
            <DialogDescription>
              <TooltipComponent content="ID del trámite">
                <span className="text-xs text-primary-400">
                  #{formatUUID(tramite.id)}
                </span>
              </TooltipComponent>
            </DialogDescription>
          </div>

          {getStatusBadge(tramite.status, "general")}
        </DialogHeader>

        <Separator className="my-1" />

        <>
          {/* Información del trámite */}
          {loading && (
            <LoadingStateModal
              title="Actualizando trámite..."
              description="Espere unos segundos mientras actualizamos el estado del trámite."
            />
          )}
          <div className="grid grid-cols-2 gap-4 bg-primary-50 p-3 rounded-md text-sm">
            <div className="flex items-center space-x-2">
              <CalendarIcon className="h-4 w-4 text-primary-500" />
              <span className="font-medium">Creado:</span>
              <span>{formatDate(tramite.creation_date || "")}</span>
            </div>
            {tramite.status !== "Tramitable" &&
              tramite.status !== "Borrador" &&
              tramite.status !== "Scoring" && (
                <div className="flex items-center space-x-2">
                  <CalendarIcon className="h-4 w-4 text-primary-500" />
                  <span className="font-medium">Tramitado:</span>
                  <span>{formatDate(tramite.tramitation_date || "")}</span>
                </div>
              )}
            {tramite.status === "Activo" && (
              <div className="flex items-center space-x-2">
                <CalendarIcon className="h-4 w-4 text-primary-500" />
                <span className="font-medium">Activado:</span>
                <span>{formatDate(tramite.activation_date || "")}</span>
              </div>
            )}
          </div>

          <div className="grid gap-6 py-4">
            {/* Estado */}
            <div className="mx-auto w-full space-y-8">
              <div className="flex items-center gap-4">
                <SelectComponent
                  onChange={(value) => handleSelectChange(value, "status")}
                  name="status"
                  label="Estado"
                  items={statusItems}
                  selectedKey={formData.status}
                  disabled={tramite.status === "Activo"}
                  isRequired
                />
                {(isActivo || isBaja) && !isComercial && (
                  <SelectComponent
                    onChange={(value) =>
                      handleSelectChange(value, "liquidez_status")
                    }
                    name="liquidez_status"
                    label="Estado de liquidez"
                    items={
                      isBaja ? BAJA_LIQUIDEZ_STATUS : PLAIN_LIQUIDEZ_STATUS
                    }
                    selectedKey={formData.liquidez_status || ""}
                  />
                )}
              </div>

              {isActivo && tramite.status !== "Activo" && (
                <div className="flex items-center gap-4 w-full">
                  <div className="space-y-1 w-full">
                    <Label htmlFor="activation_date">Fecha de Activación</Label>
                    <DatePicker
                      date={formData.activation_date as Date}
                      setDate={(value) =>
                        handleDateChange(value as Date, "activation_date")
                      }
                    />
                  </div>
                  <div className="space-y-1 w-full">
                    <Label htmlFor="renovation_date">Fecha de Renovación</Label>
                    <DatePicker
                      date={formData.renovation_date as Date}
                      setDate={(value) =>
                        handleDateChange(value as Date, "renovation_date")
                      }
                    />
                  </div>
                </div>
              )}
              {isVerificado && tramite.status === "Tramitable" && (
                <>
                  <div className="space-y-1 w-full">
                    <Label htmlFor="renovation_date">
                      Fecha de Tramitación
                    </Label>
                    <DatePicker
                      date={formData.tramitation_date as Date}
                      setDate={(value) =>
                        handleDateChange(value as Date, "tramitation_date")
                      }
                    />
                  </div>

                  {canShowImaginaSwitch ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between rounded-md border border-primary-100 bg-primary-50 p-3">
                        <div className="space-y-1">
                          <Label htmlFor="send-to-imagina">
                            Enviar contrato a Imagina Energía
                          </Label>
                          <p className="text-xs text-primary-500">
                            Se enviará tras guardar el estado Verificado y el
                            trámite pasará a &quot;{SENT_TO_SUPPLIER_STATUS}&quot;.
                          </p>
                        </div>
                        <Switch
                          id="send-to-imagina"
                          checked={canShowImaginaSwitch && sendToImagina}
                          onCheckedChange={handleSendToImaginaChange}
                        />
                      </div>

                      {sendToImagina && imaginaCheck.status === "checking" ? (
                        <p className="flex items-center gap-2 text-xs text-primary-500">
                          <Loader2 className="size-3.5 animate-spin" />
                          Comprobando los datos para Imagina Energía…
                        </p>
                      ) : null}
                      {sendToImagina && imaginaCheck.status === "ok" ? (
                        <p className="flex items-center gap-2 rounded-md border border-success-400 bg-success-50 p-2 text-xs text-success-600">
                          <CircleCheck className="size-4" />
                          Datos completos: el contrato se enviará al actualizar.
                        </p>
                      ) : null}
                      {sendToImagina && imaginaCheck.status === "error" ? (
                        <p className="rounded-md border border-danger-400 bg-danger-50 p-2 text-xs text-danger">
                          {imaginaCheck.error}
                        </p>
                      ) : null}
                      {sendToImagina &&
                      imaginaCheck.status === "missing" &&
                      imaginaContract ? (
                        <ImaginaMissingFieldsForm
                          missing={imaginaCheck.missing}
                          tramiteId={tramite.id}
                          client={client}
                          contract={imaginaContract}
                          signer={signer}
                          userData={userData}
                          onSaved={handleImaginaFieldsSaved}
                          disabled={loading}
                        />
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}

              {/* Notas */}
              <div className="mt-4">
                <Label htmlFor="note">Notas</Label>
                <Textarea
                  id="note"
                  name="note"
                  value={formData.note || ""}
                  onChange={handleChange}
                  placeholder="Añade información relevante sobre este cambio de estado..."
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>

            {/* Comisiones (solo para no comerciales) */}
            {!isComercial && (
              <>
                <Separator className="my-2" />

                <div className="space-y-4">
                  <div className="flex flex-col">
                    <div className="flex items-center space-x-2">
                      <h3 className="font-semibold text-primary">Comisiones</h3>
                      <Coins className="h-4 w-4 text-primary-500" />
                    </div>
                    <p className="text-sm text-primary-400">
                      Asegurate de que las comisiones sean correctas antes de
                      actualizar el estado.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <InputComponent
                        type="number"
                        name="comision"
                        value={formData.comision.toString()}
                        label="Comisión"
                        onChange={handleChange}
                      />
                      {needsConfirmation && (
                        <div className="flex items-center space-x-2 mt-1">
                          <Checkbox
                            id="comision-checkbox"
                            name="comisionConfirmed"
                            checked={formData.comisionConfirmed}
                            onCheckedChange={() =>
                              handleCheckboxChange(
                                !formData.comisionConfirmed,
                                "comisionConfirmed"
                              )
                            }
                          />
                          <label
                            htmlFor="comision-checkbox"
                            className="text-xs text-primary-600 cursor-pointer"
                          >
                            Confirmar
                          </label>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <InputComponent
                        type="number"
                        name="comision_sales_person"
                        value={formData.comision_sales_person.toString()}
                        label="Comisión Comercial"
                        onChange={handleChange}
                      />
                      {!salesCommissionTouched && (
                        <p className="text-xs text-primary-500">
                          Calculada automáticamente si existe una regla para
                          esta comercializadora.
                        </p>
                      )}
                      {needsConfirmation && (
                        <div className="flex items-center space-x-2 mt-1">
                          <Checkbox
                            id="comision-sales-checkbox"
                            name="comisionSalesPersonConfirmed"
                            checked={formData.comisionSalesPersonConfirmed}
                            onCheckedChange={() =>
                              handleCheckboxChange(
                                !formData.comisionSalesPersonConfirmed,
                                "comisionSalesPersonConfirmed"
                              )
                            }
                          />
                          <label
                            htmlFor="comision-sales-checkbox"
                            className="text-xs text-primary-600 cursor-pointer"
                          >
                            Confirmar
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Alertas o notificaciones */}
            {needsConfirmation && !isComercial && (
              <div className="flex items-start space-x-2 bg-yellow-50 p-3 rounded-md mt-2">
                <AlertCircleIcon className="h-5 w-5 text-yellow-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">
                    Confirmación requerida
                  </p>
                  <p className="text-xs text-yellow-600">
                    Para actualizar a un estado distinto de Tramitable o
                    Borrador, debes confirmar ambas comisiones marcando las
                    casillas de verificación.
                  </p>
                </div>
              </div>
            )}

            {isBaja && (
              <div className="flex items-start space-x-2 bg-red-50 p-3 rounded-md mt-2">
                <AlertCircleIcon className="h-5 w-5 text-red-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-800">Atención</p>
                  <p className="text-xs text-red-600">
                    Al cancelar este trámite, todas las comisiones asociadas
                    pasarán a ser negativas y el trámite no podrá ser
                    reactivado.
                  </p>
                </div>
              </div>
            )}
          </div>
        </>
        <DialogFooter>
          <ButtonGroupComponent
            onCancel={onClose}
            onSubmit={handleSubmit}
            lastStep
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
