"use client";
import { Button } from "@/core/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/core/components/ui/dialog";
import { CheckCircle, CircleX, Coins } from "lucide-react";
import ComissionsForm, { ComissionFormValues } from "./ComissionsForm";
import { ComparativaVM } from "@/comparativas/types/comparativa.types";
import { Notification } from "@/core/types";
import { useEffect, useState } from "react";
import { showCustomToast } from "@/core/components/CustomToast";
import LoadingStateModal from "@/core/components/LoadingStateModal";
import { generateComparativaUpdatedNotification } from "@/core/utils/notifications.helpers";
import { useActiveEnergySuppliers } from "@/comercializadoras/hooks/useActiveEnergySuppliers";
import { useUserCompanyCommissions } from "@/core/hooks/use-user-company-commissions";
import { calculateSalesPersonCommission } from "@/core/utils/sales-commission";

interface Props {
  comparativa: ComparativaVM;
  onUpdate: () => void;
}

export default function UpdateComissionsModal({
  comparativa,
  onUpdate,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [manualSalesCommissionFields, setManualSalesCommissionFields] =
    useState<Partial<Record<keyof ComissionFormValues, boolean>>>({});
  const { activeSuppliers } = useActiveEnergySuppliers();
  const { commissions: userCompanyCommissions } = useUserCompanyCommissions(
    comparativa.user.id,
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

  const onOpen = () => {
    setManualSalesCommissionFields({});
    setIsOpen(true);
  };

  const onClose = () => {
    setIsOpen(false);
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

  const checkEmptyComissions = () => {
    const requiredFields =
      comparativa.plan.includes("fijo") && comparativa.plan.includes("indexado")
        ? [
            "comision_fijo",
            "comision_sales_person_fijo",
            "comision_indexado",
            "comision_sales_person_indexado",
          ]
        : comparativa.plan.includes("fijo")
          ? ["comision_fijo", "comision_sales_person_fijo"]
          : ["comision_indexado", "comision_sales_person_indexado"];
    return requiredFields.some(
      (field) =>
        formDataComissions[field as keyof ComissionFormValues] === undefined ||
        formDataComissions[field as keyof ComissionFormValues] === null
    );
  };

  const handleSubmit = async () => {
    if (checkEmptyComissions()) {
      showCustomToast({
        title: "Campos vacíos",
        message:
          "Por favor, complete todos los campos de comisiones antes de actualizar.",
        iconColor: "var(--warning-color)",
        iconSize: 24,
        icon: CircleX,
      });
      return;
    }
    setLoading(true);
    try {
      const changes = checkComissionsChanged();
      if (changes) {
        const response = await fetch(
          `/api/v2/comparisons/${comparativa.id}/commissions`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              comissions: changes,
            }),
          }
        );

        const { success, error } = await response.json();

        if (!success) {
          showCustomToast({
            title: "Error al actualizar comisiones",
            message: error,
            iconColor: "var(--danger-color)",
            iconSize: 24,
            icon: CircleX,
          });
          return;
        }

        const notification: Notification =
          generateComparativaUpdatedNotification({
            comparativa_id: comparativa.id,
            client: comparativa.client,
            user_id: comparativa.user.id as string,
            comissions: changes ? true : undefined,
          });

        const NotificationResponse = await fetch(`/api/v2/notifications`, {
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

        showCustomToast({
          title: "Comisiones actualizadas",
          message: "Las comisiones se han actualizado correctamente",
          iconColor: "var(--success-color)",
          iconSize: 24,
          icon: CheckCircle,
        });
        onClose();
        onUpdate();
      } else {
        showCustomToast({
          title: "No hay cambios",
          message: "No se han realizado cambios en las comisiones",
          iconColor: "var(--warning-color)",
          iconSize: 24,
        });
        onClose();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
  return (
    <>
      <Dialog open={isOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" onClick={onOpen}>
            <Coins size={16} />
            Actualizar comisiones
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader aria-describedby={undefined}>
            <DialogTitle className="text-2xl font-bold text-primary-800">
              Actualizar comisiones
            </DialogTitle>
          </DialogHeader>
          {loading && (
            <LoadingStateModal
              title="Actualizando comisiones..."
              description="Espere unos segundos mientras actualizamos las comisiones."
            />
          )}
          <ComissionsForm
            comparativa={comparativa}
            setFormDataComissions={setFormDataComissions}
            formDataComissions={formDataComissions}
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
          <DialogFooter className="mt-4">
            <Button onClick={onClose} variant="destructive">
              Cancelar
            </Button>
            <Button onClick={handleSubmit}>Actualizar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
