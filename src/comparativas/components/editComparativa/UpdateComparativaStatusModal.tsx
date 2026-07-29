import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTrigger,
  DialogTitle,
} from "@/core/components/ui/dialog";
import { Button } from "@/core/components/ui/button";
import { Notification, User } from "@/core/types";
import {
  ComparativaStatus,
  ComparativaVM,
} from "@/comparativas/types/comparativa.types";
import { useEffect, useState } from "react";
import { showCustomToast } from "@/core/components/CustomToast";
import { CircleCheck, CircleX } from "lucide-react";
import LoadingStateModal from "@/core/components/LoadingStateModal";
import ComissionsForm, { ComissionFormValues } from "./ComissionsForm";
import { getStatusBadge } from "@/core/hooks/use-status-badge";
import { SelectComponent } from "@/tramites/components/createTramite/InputComponent";
import { Separator } from "@/core/components/ui/separator";
import { generateComparativaUpdatedNotification } from "@/core/utils/notifications.helpers";
import { formatUUID } from "@/core/utils/format";
import { useActiveEnergySuppliers } from "@/comercializadoras/hooks/useActiveEnergySuppliers";
import { useUserCompanyCommissions } from "@/core/hooks/use-user-company-commissions";
import { calculateSalesPersonCommission } from "@/core/utils/sales-commission";
import {
  getAllowedStatusOptions,
  getStatusUpdatePayload,
  hasMissingCommission,
} from "./status-options";

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
    comparativa.status,
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
          },
  );
  const [loading, setLoading] = useState(false);
  const [manualSalesCommissionFields, setManualSalesCommissionFields] =
    useState<Partial<Record<keyof ComissionFormValues, boolean>>>({});
  const { activeSuppliers } = useActiveEnergySuppliers();
  const { commissions: userCompanyCommissions } = useUserCompanyCommissions(
    comparativa.user.id,
  );
  const allowedStatusOptions = getAllowedStatusOptions(
    comparativa.status,
    userData,
    Boolean(comparativa.tramite_id),
  );

  useEffect(() => {
    setFormDataComissions((prev) => {
      const next = { ...prev };
      let changed = false;

      if (
        comparativa.plan.includes("fijo") &&
        !manualSalesCommissionFields.comision_sales_person_fijo
      ) {
        const calculatedCommission = calculateSalesPersonCommission({
          baseCommission: next.comision_fijo ?? 0,
          supplierId: comparativa.company_id,
          supplierName: comparativa.company_name,
          commissions: userCompanyCommissions,
          suppliers: activeSuppliers,
        });

        if (
          calculatedCommission !== null &&
          next.comision_sales_person_fijo !== calculatedCommission
        ) {
          next.comision_sales_person_fijo = calculatedCommission;
          changed = true;
        }
      }

      if (
        comparativa.plan.includes("indexado") &&
        !manualSalesCommissionFields.comision_sales_person_indexado
      ) {
        const calculatedCommission = calculateSalesPersonCommission({
          baseCommission: next.comision_indexado ?? 0,
          supplierId: comparativa.company_id,
          supplierName: comparativa.company_name,
          commissions: userCompanyCommissions,
          suppliers: activeSuppliers,
        });

        if (
          calculatedCommission !== null &&
          next.comision_sales_person_indexado !== calculatedCommission
        ) {
          next.comision_sales_person_indexado = calculatedCommission;
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [
    activeSuppliers,
    comparativa.company_id,
    comparativa.company_name,
    comparativa.plan,
    formDataComissions.comision_fijo,
    formDataComissions.comision_indexado,
    manualSalesCommissionFields,
    userCompanyCommissions,
  ]);

  const onClose = () => {
    setIsOpen(false);
  };

  const handleOpen = () => {
    setIsOpen(true);
    setNewStatus(comparativa.status);
    setManualSalesCommissionFields({});
  };

  const handleOpenChange = (open: boolean) => {
    if (loading) return;
    if (open) {
      handleOpen();
    } else {
      onClose();
    }
  };

  const handleChange = (value: string) => {
    setNewStatus(value as ComparativaStatus);
  };

  const checkEmptyComissions = () => {
    return (
      hasMissingCommission(Object.values(formDataComissions)) &&
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
      }

      const changes = checkComissionsChanged();
      const res = await fetch(`/api/v2/comparisons/${comparativa.id}/status`, {
        method: "PATCH",
        body: JSON.stringify(
          getStatusUpdatePayload({
            status: newStatus,
            commissions: changes,
            tramiteId: comparativa.tramite_id,
          }),
        ),
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        let errorMessage = "No se pudo actualizar el estado";
        try {
          const errorPayload: unknown = await res.json();
          if (
            typeof errorPayload === "object" &&
            errorPayload !== null &&
            "error" in errorPayload &&
            typeof errorPayload.error === "string"
          ) {
            errorMessage = errorPayload.error;
          }
        } catch {
          // Keep the generic message when the error response is not JSON.
        }
        showCustomToast({
          title: "Error al actualizar estado",
          message: errorMessage,
          icon: CircleX,
          iconColor: "var(--danger-color)",
          iconSize: 24,
        });
        return;
      }

      const statusResult = (await res.json()) as {
        success?: boolean;
        error?: string;
      };
      if (!statusResult.success) {
        showCustomToast({
          title: "Error al actualizar estado",
          message: statusResult.error ?? "No se pudo actualizar el estado",
          icon: CircleX,
          iconColor: "var(--danger-color)",
          iconSize: 24,
        });
        return;
      }

      onUpdate();
      onClose();

      let notificationFailed = false;
      const notification: Notification = generateComparativaUpdatedNotification(
        {
          comparativa_id: comparativa.id,
          client: comparativa.client,
          user_id: comparativa.user.id as string,
          status: newStatus,
          comissions: changes ? true : undefined,
        },
      );

      try {
        const notificationResponse = await fetch(`/api/v2/notifications`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ notification }),
        });
        if (!notificationResponse.ok) {
          notificationFailed = true;
        } else {
          const notificationResult = await notificationResponse.json();
          notificationFailed = !notificationResult.success;
        }
      } catch (error) {
        notificationFailed = true;
        console.error("Error sending comparison notification:", error);
      }

      let emailFailed = false;
      try {
        const emailRes = await fetch(
          "/api/v2/communications/emails/status-updates",
          {
            method: "POST",
            body: JSON.stringify({
              type: "comparativa",
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
          },
        );

        if (!emailRes.ok) {
          emailFailed = true;
        } else {
          const emailResult = await emailRes.json();
          emailFailed = !emailResult.success;
        }
      } catch (error) {
        emailFailed = true;
        console.error("Error sending comparison status email:", error);
      }

      showCustomToast({
        title: "Estado actualizado",
        message:
          notificationFailed || emailFailed
            ? "El estado se actualizó, pero no se pudieron enviar todos los avisos."
            : "El estado de la comparativa ha sido actualizado correctamente",
        icon: CircleCheck,
        iconColor:
          notificationFailed || emailFailed
            ? "var(--warning-color)"
            : "var(--success-color)",
        iconSize: 24,
      });
    } catch (error) {
      onUpdate();
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
      case "rechazado_cliente":
        return "Rechazado Cliente";
      case "awaiting_review":
        return "Pendiente de Revisión";
      default:
        return status;
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button variant="outline">Actualizar</Button>
        </DialogTrigger>
        <DialogContent
          aria-describedby={undefined}
          className="w-full max-w-2xl"
        >
          <DialogHeader>
            <div className="flex items-center justify-between w-full">
              <DialogTitle className="text-xl font-semibold text-primary-800">
                Comparativa {formatUUID(comparativa.id)} · {comparativa.client}
              </DialogTitle>

              {getStatusBadge(comparativa.status, "comparativa")}
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
                items={allowedStatusOptions}
                disabled={loading || allowedStatusOptions.length === 0}
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
                    onSalesCommissionManualChange={(field) =>
                      setManualSalesCommissionFields((prev) => ({
                        ...prev,
                        [field]: true,
                      }))
                    }
                    showAutoSalesCommissionHint={
                      !manualSalesCommissionFields.comision_sales_person_fijo ||
                      !manualSalesCommissionFields.comision_sales_person_indexado
                    }
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
            <Button onClick={onClose} variant="destructive" disabled={loading}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || !checkStatusChanged()}
            >
              {loading ? "Actualizando..." : "Actualizar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
