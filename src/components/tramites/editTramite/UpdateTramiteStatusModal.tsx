import ButtonGroupComponent from "@/components/core/ButtonGroupComponent";
import { LiquidezStatus, Status, TramiteVM, User } from "@/lib/core/types";
import { getStatusBadge } from "@/lib/hooks/use-status-badge";
import {
  Modal,
  ModalHeader,
  ModalContent,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import {
  InputComponent,
  SelectComponent,
} from "../createTramite/InputComponent";
import {
  BAJA_LIQUIDEZ_STATUS,
  COMERCIAL_STATUS_TYPES,
  PLAIN_LIQUIDEZ_STATUS,
  PLAIN_STATUS_TYPES,
} from "@/lib/core/const";
import { useState, useEffect } from "react";
import { Divider } from "@heroui/divider";
import {
  CalendarIcon,
  AlertCircleIcon,
  Coins,
  CircleX,
  CheckSquare,
} from "lucide-react";
import { Tooltip } from "@heroui/tooltip";
import { formatDate } from "@/lib/core/format";
import { showCustomToast } from "@/components/core/CustomToast";
import { Textarea } from "@heroui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { generateTramiteUpdatedNotification } from "@/lib/core/notifications.helpers";
import LoadingStateModal from "@/components/core/LoadingStateModal";

interface Props {
  tramite: TramiteVM;
  isOpen: boolean;
  onClose: () => void;
  userData: User;
  onUpdate: () => void;
}

interface FormData {
  status: Status;
  liquidez_status: LiquidezStatus;
  comision: number;
  comision_sales_person: number;
  note?: string;
  comisionConfirmed: boolean;
  comisionSalesPersonConfirmed: boolean;
  collection_date: string | null;
  payment_date: string | null;
}

export default function UpdateTramiteStatusModal({
  tramite,
  isOpen,
  onClose,
  userData,
  onUpdate,
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
  });

  const isComercial = userData && userData.role === "2";
  const isTramitable = formData.status === "Tramitable";
  const isBorrador = formData.status === "Borrador";
  const isBaja = formData.status === "Baja";
  const isActivo = formData.status === "Activo";
  const [loading, setLoading] = useState(false);

  // Estado para controlar si podemos actualizar
  const [canUpdate, setCanUpdate] = useState(isTramitable || isBorrador);

  // Verificar si necesitamos confirmación de comisiones
  const needsConfirmation =
    tramite.status === "Tramitable" &&
    formData.status !== "Borrador" &&
    formData.status !== "Tramitable" &&
    formData.status !== "Baja";

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

  const handleChange = (
    e:
      | React.ChangeEvent<HTMLSelectElement>
      | React.ChangeEvent<HTMLInputElement>
      | React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    if (name === "status" && value === "Activo") {
      setFormData((prev) => ({
        ...prev,
        liquidez_status: "Pendiente de Cobro",
        comision: Math.abs(prev.comision),
        comision_sales_person: Math.abs(prev.comision_sales_person),
      }));
    }

    if (name === "status" && value === "Baja") {
      setFormData((prev) => ({
        ...prev,
        comision: -prev.comision,
        comision_sales_person: -prev.comision_sales_person,
      }));
    }

    if (name === "liquidez_status") {
      if (value === "Cobrado por Comercializadora") {
        setFormData((prev) => ({
          ...prev,
          liquidez_status: value,
          collection_date: new Date().toISOString(),
        }));
      } else if (value === "Pagado al Comercial") {
        setFormData((prev) => ({
          ...prev,
          liquidez_status: value,
          payment_date: new Date().toISOString(),
        }));
      } else {
        setFormData((prev) => ({
          ...prev,
          liquidez_status: value as LiquidezStatus,
        }));
      }
    }

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

      const res = await fetch(`/api/tramites/update/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tramite_id: tramite.id,
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
            ? formData.collection_date
            : undefined,
          payment_date: formData.payment_date
            ? formData.payment_date
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

      const notification = generateTramiteUpdatedNotification(
        { tramite: { status: formData.status } },
        [],
        tramite.id,
        tramite.user_id
      );

      const notificationRes = await fetch("/api/notifications/create", {
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
        const emailRes = await fetch("/api/send-email/tramite-status-updated", {
          method: "POST",
          body: JSON.stringify({
            user_to: {
              email: tramite.user.email,
              name: tramite.user.name,
              org_logo: tramite.user.organization?.logo,
            },
            tramite_id: tramite.id,
            status: { old: tramite.status, new: formData.status },
          }),
          headers: {
            "Content-Type": "application/json",
          },
        });

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
        message: `Los cambios se han guardado correctamente. Se ha notitificado a ${tramite.user.name}.`,
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

  return (
    <Modal
      isDismissable={false}
      hideCloseButton
      size="2xl"
      isOpen={isOpen}
      onClose={onClose}
    >
      <ModalContent>
        <ModalHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-semibold text-primary">
              Actualizar Estado
            </h2>
            <Tooltip content="ID del trámite">
              <span className="text-xs text-primary-400">#{tramite.id}</span>
            </Tooltip>
          </div>
          <div className="flex-shrink-0">{getStatusBadge(tramite.status)}</div>
        </ModalHeader>

        <Divider className="my-1" />

        <ModalBody>
          {/* Información del trámite */}
          {loading && <LoadingStateModal userData={userData as User} />}
          <div className="grid grid-cols-2 gap-4 bg-primary-50 p-3 rounded-md text-sm">
            <div className="flex items-center space-x-2">
              <CalendarIcon className="h-4 w-4 text-primary-500" />
              <span className="font-medium">Creado:</span>
              <span>{formatDate(tramite.creation_date || "")}</span>
            </div>
          </div>

          <div className="grid gap-6 py-4">
            {/* Estado */}
            <div className="mx-auto w-full">
              <div className="flex items-center gap-4">
                <SelectComponent
                  onChange={handleChange}
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
                    onChange={handleChange}
                    name="liquidez_status"
                    label="Estado de liquidez"
                    items={
                      isBaja ? BAJA_LIQUIDEZ_STATUS : PLAIN_LIQUIDEZ_STATUS
                    }
                    selectedKey={formData.liquidez_status || ""}
                  />
                )}
              </div>

              {/* Notas */}
              <div className="mt-4">
                <Textarea
                  name="note"
                  label="Notas sobre el cambio de estado"
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
                <Divider className="my-2" />

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
        </ModalBody>
        <ModalFooter>
          <ButtonGroupComponent
            onCancel={onClose}
            onSubmit={handleSubmit}
            lastStep
          />
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
