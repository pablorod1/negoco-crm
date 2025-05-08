import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTrigger,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ComparativaStatus,
  ComparativaVM,
  Notification,
  User,
} from "@/lib/core/types";
import { useState } from "react";
import { showCustomToast } from "@/components/core/CustomToast";
import { CircleCheck, CircleX } from "lucide-react";
import LoadingStateModal from "@/components/core/LoadingStateModal";
import ComissionsForm, { ComissionFormValues } from "./ComissionsForm";
import { getStatusBadge } from "@/lib/hooks/use-status-badge";
import { SelectComponent } from "@/components/tramites/createTramite/InputComponent";
import { COMPARATIVA_STATUS_TYPES } from "@/lib/core/const";
import { Separator } from "@/components/ui/separator";
import { generateComparativaUpdatedNotification } from "@/lib/core/notifications.helpers";

interface Props {
  comparativa: ComparativaVM;
  onUpdate: () => void;
  userData: User;
}

export default function UpdateComparativaStatusModal({
  comparativa,
  onUpdate,
  userData,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<ComparativaStatus>(
    comparativa.status
  );
  const [formDataComissions, setFormDataComissions] = useState<
    Partial<ComissionFormValues>
  >(
    comparativa.plan.includes("fijo") && comparativa.plan.includes("indexado")
      ? {
          comision_fijo: comparativa.comision.fijo,
          comision_indexado: comparativa.comision.indexado,
          comision_sales_person_fijo: comparativa.comision_sales_person.fijo,
          comision_sales_person_indexado:
            comparativa.comision_sales_person.indexado,
        }
      : comparativa.plan.includes("fijo")
        ? {
            comision_fijo: comparativa.comision.fijo,
            comision_sales_person_fijo: comparativa.comision_sales_person.fijo,
          }
        : {
            comision_indexado: comparativa.comision.indexado,
            comision_sales_person_indexado:
              comparativa.comision_sales_person.indexado,
          }
  );
  const [loading, setLoading] = useState(false);

  const onClose = () => {
    setIsOpen(false);
  };

  const handleOpen = () => {
    setIsOpen(true);
    setNewStatus(comparativa.status);
  };

  const handleChange = (value: string) => {
    setNewStatus(value as ComparativaStatus);
  };

  const checkEmptyComissions = () => {
    return (
      Object.values(formDataComissions).some((value) => !value) &&
      newStatus === "completed"
    );
  };

  const checkStatusChanged = () => {
    return newStatus !== comparativa.status;
  };

  const checkComissionsChanged = () => {
    const changes = {
      comision_fijo:
        formDataComissions.comision_fijo !== comparativa.comision.fijo
          ? formDataComissions.comision_fijo
          : undefined,
      comision_indexado:
        formDataComissions.comision_indexado !== comparativa.comision.indexado
          ? formDataComissions.comision_indexado
          : undefined,
      comision_sales_person_fijo:
        formDataComissions.comision_sales_person_fijo !==
        comparativa.comision_sales_person.fijo
          ? formDataComissions.comision_sales_person_fijo
          : undefined,
      comision_sales_person_indexado:
        formDataComissions.comision_sales_person_indexado !==
        comparativa.comision_sales_person.indexado
          ? formDataComissions.comision_sales_person_indexado
          : undefined,
    };

    return Object.values(changes).some((value) => value !== undefined)
      ? changes
      : null;
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      if (checkEmptyComissions()) {
        showCustomToast({
          title: "Error al actualizar las comisiones",
          message: "Por favor, rellena todos los campos",
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: CircleX,
        });
        return;
      } else {
        const changes = checkComissionsChanged();

        const res = await fetch(
          `/api/comparativas/update/${comparativa.id}/status`,
          {
            method: "PATCH",
            body: JSON.stringify({
              status: newStatus,
              comissions: changes ? changes : undefined,
            }),
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        const { success, error } = await res.json();

        if (!success) {
          showCustomToast({
            title: "Error al actualizar estado",
            message: error,
            icon: CircleX,
            iconColor: "var(--danger-color)",
            iconSize: 24,
          });
          return;
        }

        const notification: Notification =
          generateComparativaUpdatedNotification({
            comparativa_id: comparativa.id,
            client: comparativa.client,
            user_id: comparativa.user.id as string,
            status: checkStatusChanged() ? newStatus : undefined,
            comissions: changes ? true : undefined,
          });

        const NotificationResponse = await fetch(`/api/notifications/create`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ notification }),
        });
        const { success: NotificationSuccess, error: NotificationError } =
          await NotificationResponse.json();

        if (!NotificationSuccess && NotificationError) {
          showCustomToast({
            title: "Error al notificar cambios",
            message: NotificationError,
            iconColor: "var(--danger-color)",
            iconSize: 24,
            icon: CircleX,
          });
          return;
        }

        if (checkStatusChanged()) {
          const emailRes = await fetch(
            "/api/send-email/comparativa-status-updated",
            {
              method: "POST",
              body: JSON.stringify({
                user_to: {
                  email: comparativa.user.email,
                  name: comparativa.user.name,
                  org_logo: userData.organization.logo,
                },
                comparativa_id: comparativa.id,
                status: { old: comparativa.status, new: newStatus },
                comparativa_name: comparativa.client,
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
          title: "Estado Actualizado",
          message:
            "El estado de la comparativa ha sido actualizado correctamente",
          icon: CircleCheck,
          iconColor: "var(--success-color)",
          iconSize: 24,
        });
      }
      onUpdate();
      onClose();
    } catch (error) {
      showCustomToast({
        title: "Error al actualizar estado",
        message: "Ocurrió un error al actualizar el estado de la comparativa",
        icon: CircleX,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
      console.error("Error updating comparativa status:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatStatus = (status: ComparativaStatus) => {
    switch (status) {
      case "pending":
        return "Pendiente de Estudio";
      case "completed":
        return "Estudio Realizado";
      case "processed":
        return "Completada";
      case "rejected":
        return "Rechazada";
      default:
        return status;
    }
  };

  return (
    <>
      <Dialog open={isOpen}>
        <DialogTrigger asChild>
          <Button onClick={handleOpen} variant="outline">
            Actualizar
          </Button>
        </DialogTrigger>
        <DialogContent
          aria-describedby={undefined}
          className="w-full max-w-2xl"
        >
          <DialogHeader>
            <div className="flex items-center justify-between w-full">
              <DialogTitle className="text-xl font-semibold text-primary-800">
                Comparativa {comparativa.id} · {comparativa.client}
              </DialogTitle>

              {getStatusBadge(comparativa.status)}
            </div>
          </DialogHeader>
          {loading && (
            <LoadingStateModal
              title="Actualizando comparativa..."
              description="Espere unos segundos mientras actualizamos el estado de la comparativa."
            />
          )}
          <div className="space-y-4">
            <div className="space-y-2">
              <SelectComponent
                name="status"
                isRequired
                label="Estado"
                selectedKey={newStatus}
                textValue={formatStatus(newStatus)}
                onChange={handleChange}
                items={COMPARATIVA_STATUS_TYPES}
              />
            </div>
            {newStatus === "completed" && (
              <>
                <Separator />
                <div className="flex flex-col gap-2">
                  <ComissionsForm
                    comparativa={comparativa}
                    formDataComissions={formDataComissions}
                    setFormDataComissions={setFormDataComissions}
                  />
                  <div className="flex items-start gap-1">
                    <small className="text-gray-500">*</small>
                    <div className=" flex flex-col gap-1">
                      <p className="text-sm text-gray-500">
                        Comprueba las comisiones de la comparativa antes de
                        actualizar el estado.
                      </p>
                      <p className="text-sm text-gray-500">
                        Para completar el estudio de la comparativa, es
                        necesario que las comisiones estén asignadas.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button onClick={onClose} variant="destructive">
              Cancelar
            </Button>
            <Button onClick={handleSubmit}>
              {loading ? "Actualizando..." : "Actualizar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
