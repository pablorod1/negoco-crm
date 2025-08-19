"use client";
import ButtonGroupComponent from "@/core/components/ButtonGroupComponent";
import { Notification, User } from "@/core/types";
import { ClientDB, LiquidezStatus, Status, TramiteVM } from "@/tramites/types";
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
} from "@/tramites/constants";
import { NOW_DATE, RENOVATION_DATE } from "@/dashboard/constants";
import { useState, useEffect } from "react";
import {
  CalendarIcon,
  AlertCircleIcon,
  Coins,
  CircleX,
  CheckSquare,
} from "lucide-react";
import { formatDate, formatUUID } from "@/core/utils/format";
import { showCustomToast } from "@/core/components/CustomToast";
import { Textarea } from "@/core/components/ui/textarea";
import { Checkbox } from "@/core/components/ui/checkbox";
import { generateTramiteUpdatedNotification } from "@/core/utils/notifications.helpers";
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

interface Props {
  tramite: TramiteVM;
  userData: User;
  onUpdate: () => void;
  client: ClientDB;
}

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

export default function UpdateTramiteStatusModal({
  tramite,
  userData,
  onUpdate,
  client,
}: Props) {
  const [formData, setFormData] = useState<FormData>({
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
  const [isOpen, setIsOpen] = useState(false);

  const isComercial = userData && userData.role === "2";
  const isTramitable = formData.status === "Tramitable";
  const isBorrador = formData.status === "Borrador";
  const isBaja = formData.status === "Baja";
  const isActivo = formData.status === "Activo";
  const isVerificado = formData.status === "Verificado";
  const [loading, setLoading] = useState(false);

  // Estado para controlar si podemos actualizar
  const [canUpdate, setCanUpdate] = useState(isTramitable || isBorrador);

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

  const checkStatusChanged = () => {
    return formData.status !== tramite.status;
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

      const notification: Notification = generateTramiteUpdatedNotification({
        changes: { tramite: { status: formData.status } },
        client: `${client.name} ${client.last_name}`,
        tramite_id: tramite.id,
        user_id: tramite.user_id,
      });

      const notificationRes = await fetch("/api/v2/notifications", {
        method: "POST",
        body: JSON.stringify({ notification }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const { success: notificationSuccess, error: notificationError } =
        await notificationRes.json();

      if (!notificationSuccess) {
        showCustomToast({
          title: "Error al enviar notificación",
          message: notificationError as string,
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: CircleX,
        });
        return;
      }

      if (checkStatusChanged()) {
        const emailRes = await fetch(
          "/api/v2/communications/emails/status-updates",
          {
            method: "POST",
            body: JSON.stringify({
              type: "tramite",
              user_to: {
                email: tramite.user.email,
                name: tramite.user.name,
                org_logo: userData.organization.logo,
              },
              tramite_id: tramite.id,
              status: { old: tramite.status, new: formData.status },
              client: { name: client.name, last_name: client.last_name },
            }),
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        const { success: emailSuccess, error: emailError } =
          await emailRes.json();

        if (!emailSuccess) {
          showCustomToast({
            title: "Error al enviar notificación por email",
            message: emailError as string,
            iconColor: "var(--danger-color)",
            iconSize: 24,
            icon: CircleX,
          });
          return;
        }
      }

      showCustomToast({
        title: "Cambios guardados",
        message: `Los cambios se han guardado correctamente. Se ha notificado a ${tramite.user.name}.`,
        iconColor: "var(--success-color)",
        iconSize: 24,
        icon: CheckSquare,
      });
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
        <Button variant="outline" onClick={() => setIsOpen(true)}>
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
                  items={
                    userData.role === "2"
                      ? COMERCIAL_STATUS_TYPES
                      : PLAIN_STATUS_TYPES
                  }
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
                <div className="space-y-1 w-full">
                  <Label htmlFor="renovation_date">Fecha de Tramitación</Label>
                  <DatePicker
                    date={formData.tramitation_date as Date}
                    setDate={(value) =>
                      handleDateChange(value as Date, "tramitation_date")
                    }
                  />
                </div>
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
