"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTrigger,
  DialogTitle,
  DialogDescription,
} from "@/core/components/ui/dialog";
import { Button } from "@/core/components/ui/button";
import { User, Notification } from "@/core/types";
import { ComparativaVM, ComparativaFile } from "@/comparativas/types";
import { showCustomToast } from "@/core/components/CustomToast";
import { CheckCircle, CircleX, XCircle } from "lucide-react";
import LoadingStateModal from "@/core/components/LoadingStateModal";
import ComissionsForm, { ComissionFormValues } from "./ComissionsForm";
import { Separator } from "@/core/components/ui/separator";
import { generateComparativaUpdatedNotification } from "@/core/utils/notifications.helpers";
import { uploadFile } from "@/core/firebase/data/uploadFiles";
import DocumentsForm from "@/tramites/components/DocumentsForm";
import { useActiveEnergySuppliers } from "@/comercializadoras/hooks/useActiveEnergySuppliers";
import { Label } from "@/core/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/core/components/ui/select";
import { useUserCompanyCommissions } from "@/core/hooks/use-user-company-commissions";
import { calculateSalesPersonCommission } from "@/core/utils/sales-commission";

interface Props {
  comparativa: ComparativaVM;
  onUpdate: () => void;
  userData: User;
  mode?: "manual" | "ai_review";
  canCompleteStudies: boolean;
  canReviewStudies?: boolean;
}

type ActionType = "complete" | "reject" | null;

export default function CompletarEstudioModal({
  comparativa,
  onUpdate,
  userData,
  mode = "manual",
  canCompleteStudies,
  canReviewStudies = false,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [actionType, setActionType] = useState<ActionType>(null);
  const [loading, setLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [manualSalesCommissionFields, setManualSalesCommissionFields] =
    useState<Partial<Record<keyof ComissionFormValues, boolean>>>({});

  // Load active energy suppliers
  const { activeSuppliers } = useActiveEnergySuppliers();
  const { commissions: userCompanyCommissions } = useUserCompanyCommissions(
    comparativa.user.id,
  );

  // Auto-match the supplier returned by the AI study.
  useEffect(() => {
    if (
      mode !== "ai_review" ||
      selectedSupplierId ||
      activeSuppliers.length === 0
    )
      return;

    const empresa = comparativa.abarca_estudio?.empresa;
    if (!empresa) return;

    // Extract company name before " - " (e.g. "NATURGY - POR USO LUZ" → "naturgy")
    const companyName = empresa.split(" - ")[0].trim().toLowerCase();
    if (!companyName) return;

    const match = activeSuppliers.find((s) =>
      s.name.toLowerCase().includes(companyName),
    );

    if (match) {
      setSelectedSupplierId(match.id);
    }
  }, [
    mode,
    activeSuppliers,
    comparativa.abarca_estudio?.empresa,
    selectedSupplierId,
  ]);

  // Comisiones state
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
          supplierId: selectedSupplierId,
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
          supplierId: selectedSupplierId,
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
    comparativa.plan,
    formDataComissions.comision_fijo,
    formDataComissions.comision_indexado,
    manualSalesCommissionFields,
    selectedSupplierId,
    userCompanyCommissions,
  ]);

  const onClose = () => {
    setIsOpen(false);
    setActionType(null);
    setUploadedFiles([]);
    setSelectedSupplierId("");
    setManualSalesCommissionFields({});
    setFormDataComissions(
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
              comision_sales_person_fijo:
                comparativa.comision_sales_person.fijo,
            }
          : {
              comision_indexado: comparativa.comision.indexado,
              comision_sales_person_indexado:
                comparativa.comision_sales_person.indexado,
            },
    );
  };

  const handleOpen = (action: ActionType) => {
    setIsOpen(true);
    setActionType(action);
  };

  const checkEmptyComissions = () => {
    return Object.values(formDataComissions).some((value) => !value);
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

  const handleRejectComparativa = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v2/comparisons/${comparativa.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "rejected",
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const { success, error } = await res.json();

      if (!success) {
        showCustomToast({
          title: "Error al rechazar comparativa",
          message: error,
          icon: CircleX,
          iconColor: "var(--danger-color)",
          iconSize: 24,
        });
        return;
      }

      // Enviar notificación
      const notification: Notification = generateComparativaUpdatedNotification(
        {
          comparativa_id: comparativa.id,
          client: comparativa.client,
          user_id: comparativa.user.id as string,
          status: "rejected",
        },
      );

      const notificationResponse = await fetch(`/api/v2/notifications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notification }),
      });

      const { success: notificationSuccess, error: notificationError } =
        await notificationResponse.json();

      if (!notificationSuccess && notificationError) {
        console.warn("Error al enviar notificación:", notificationError);
      }

      // Enviar email de notificación
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
            status: { old: comparativa.status, new: "rejected" },
            comparativa_name: comparativa.client,
          }),
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      const { success: emailSuccess, error: emailError } =
        await emailRes.json();

      if (!emailSuccess) {
        console.warn("Error al enviar email:", emailError);
      }

      showCustomToast({
        title: "Comparativa Rechazada",
        message: "La comparativa ha sido rechazada correctamente",
        icon: CheckCircle,
        iconColor: "var(--success-color)",
        iconSize: 24,
      });

      onUpdate();
      onClose();
    } catch (error) {
      showCustomToast({
        title: "Error al rechazar comparativa",
        message: "Ocurrió un error al rechazar la comparativa",
        icon: CircleX,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
      console.error("Error rejecting comparativa:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteEstudio = async () => {
    if (mode === "manual" && uploadedFiles.length === 0) {
      showCustomToast({
        title: "Archivo requerido",
        message: "Debes subir al menos un archivo para completar el estudio",
        iconColor: "var(--danger-color)",
        iconSize: 24,
        icon: CircleX,
      });
      return;
    }

    if (!selectedSupplierId) {
      showCustomToast({
        title: "Comercializadora requerida",
        message: "Por favor, selecciona la comercializadora ganadora",
        iconColor: "var(--danger-color)",
        iconSize: 24,
        icon: CircleX,
      });
      return;
    }

    if (checkEmptyComissions()) {
      showCustomToast({
        title: "Comisiones requeridas",
        message: "Por favor, asigna todas las comisiones",
        iconColor: "var(--danger-color)",
        iconSize: 24,
        icon: CircleX,
      });
      return;
    }

    setLoading(true);
    try {
      // 1. Subir archivos (solo en modo manual)
      const comparativaFiles: ComparativaFile[] = [];

      if (mode === "manual") {
        for (const file of uploadedFiles) {
          try {
            const { downloadURL, previewURL } = await uploadFile(
              file,
              `${userData.organization.id}/comparativas`,
              comparativa.id,
            );

            comparativaFiles.push({
              id: crypto.randomUUID(),
              comparativa_id: comparativa.id,
              filename: file.name,
              size: file.size,
              extension: file.name.split(".").pop() || "",
              upload_date: new Date().toISOString(),
              download_url: downloadURL,
              preview_url: previewURL || null,
            });
          } catch (error) {
            showCustomToast({
              title: "Error al subir archivo",
              message: "Inténtalo de nuevo más tarde",
              iconColor: "var(--danger-color)",
              iconSize: 24,
              icon: CircleX,
            });
            console.error("Error uploading file:", error);
            return;
          }
        }
      }

      // 2. Actualizar estado y comisiones
      const changes = checkComissionsChanged();

      const res = await fetch(`/api/v2/comparisons/${comparativa.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "completed",
          comissions: changes ? changes : undefined,
          company_id: selectedSupplierId,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const { success, error } = await res.json();

      if (!success) {
        showCustomToast({
          title: "Error al completar estudio",
          message: error,
          icon: CircleX,
          iconColor: "var(--danger-color)",
          iconSize: 24,
        });
        return;
      }

      // 3. Agregar archivos (solo en modo manual)
      if (mode === "manual" && comparativaFiles.length > 0) {
        const formData = new FormData();
        formData.append("organization_id", userData.organization.id);
        formData.append("files", JSON.stringify(comparativaFiles));
        formData.append("estudio_realizado", "true");

        const uploadResponse = await fetch(
          `/api/v2/comparisons/${comparativa.id}/documents`,
          {
            method: "POST",
            body: formData,
          },
        );

        const { success: uploadSuccess, error: uploadError } =
          await uploadResponse.json();

        if (!uploadSuccess) {
          showCustomToast({
            title: "Error al subir archivos",
            message: uploadError,
            iconColor: "var(--danger-color)",
            iconSize: 24,
            icon: CircleX,
          });
          return;
        }
      }

      // 4. Enviar notificación
      const notification: Notification = generateComparativaUpdatedNotification(
        {
          comparativa_id: comparativa.id,
          client: comparativa.client,
          user_id: comparativa.user.id as string,
          status: "completed",
          files: mode === "manual" ? true : undefined,
          comissions: changes ? true : undefined,
        },
      );

      const notificationResponse = await fetch(`/api/v2/notifications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notification }),
      });

      const { success: notificationSuccess, error: notificationError } =
        await notificationResponse.json();

      if (!notificationSuccess && notificationError) {
        console.warn("Error al enviar notificación:", notificationError);
      }

      // 5. Enviar email
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
            status: { old: comparativa.status, new: "completed" },
            comparativa_name: comparativa.client,
          }),
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      const { success: emailSuccess, error: emailError } =
        await emailRes.json();

      if (!emailSuccess) {
        console.warn("Error al enviar email:", emailError);
      }

      showCustomToast({
        title: "Estudio Completado",
        message: "El estudio ha sido completado correctamente",
        icon: CheckCircle,
        iconColor: "var(--success-color)",
        iconSize: 24,
      });

      onUpdate();
      onClose();
    } catch (error) {
      showCustomToast({
        title: "Error al completar estudio",
        message: "Ocurrió un error al completar el estudio",
        icon: CircleX,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
      console.error("Error completing study:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatUUID = (uuid: string) => {
    return uuid.slice(-8).toUpperCase();
  };

  const hasAllowedStatus =
    mode === "ai_review"
      ? comparativa.status === "awaiting_review"
      : comparativa.status === "pending" ||
        comparativa.status === "processing";
  if (!hasAllowedStatus) {
    return null;
  }

  if (
    (mode === "ai_review" && !canReviewStudies) ||
    (mode === "manual" && !canCompleteStudies)
  ) {
    return null;
  }

  // AI review does not upload files or allow rejection.
  if (mode === "ai_review") {
    return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button
            variant="default"
            size="sm"
            className="w-full gap-2"
            onClick={() => handleOpen("complete")}
          >
            <CheckCircle className="h-4 w-4" />
            Asignar Comercializadora y Comisiones
          </Button>
        </DialogTrigger>
        <DialogContent
          aria-describedby={undefined}
          className="w-full max-w-3xl max-h-[95dvh] h-full overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-primary-800">
              Revisión de estudio · {comparativa.client}
            </DialogTitle>
            <DialogDescription>
              El estudio con IA se ha recibido correctamente. Asigna la
              comercializadora ganadora y las comisiones para completar la
              comparativa.
            </DialogDescription>
          </DialogHeader>

          {loading && (
            <LoadingStateModal
              title="Completando revisión..."
              description="Espere unos segundos mientras procesamos la revisión."
            />
          )}

          <div className="space-y-6">
            {/* Seleccionar Comercializadora */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-900">
                Comercializadora Ganadora{" "}
                <span className="text-red-500 text-xs">*</span>
              </h3>
              <div className="space-y-2">
                <Label
                  htmlFor="supplier-select-ai-review"
                  className="text-sm text-gray-600"
                >
                  Selecciona la comercializadora que ganó la comparativa
                </Label>
                <Select
                  value={selectedSupplierId}
                  onValueChange={setSelectedSupplierId}
                >
                  <SelectTrigger
                    id="supplier-select-ai-review"
                    className="w-full"
                  >
                    <SelectValue placeholder="Seleccionar comercializadora..." />
                  </SelectTrigger>
                  <SelectContent>
                    {activeSuppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Comisiones */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-900">
                Asignar Comisiones{" "}
                <span className="text-red-500 text-xs">*</span>
              </h3>
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
            </div>
          </div>

          <DialogFooter>
            <Button onClick={onClose} variant="outline">
              Cancelar
            </Button>
            <Button
              onClick={handleCompleteEstudio}
              disabled={
                checkEmptyComissions() || !selectedSupplierId || loading
              }
            >
              {loading ? "Completando..." : "Completar Revisión"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      {/* Botón para rechazar */}
      <Button
        variant="destructiveOutline"
        size="sm"
        onClick={() => handleOpen("reject")}
      >
        <XCircle className="h-4 w-4" />
        Rechazar
      </Button>

      {/* Modal para confirmar rechazo */}
      <Dialog open={isOpen && actionType === "reject"} onOpenChange={setIsOpen}>
        <DialogContent className="w-full max-w-md max-h-[95dvh] h-full overflow-y-auto">
          <DialogHeader>
            <DialogTitle>¿Rechazar comparativa?</DialogTitle>
            <DialogDescription>
              Esta acción cambiará el estado de la comparativa a
              &quot;Rechazada&quot;. El usuario comercial será notificado de
              este cambio.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={onClose} variant="outline">
              Cancelar
            </Button>
            <Button
              onClick={handleRejectComparativa}
              variant="destructive"
              disabled={loading}
            >
              {loading ? "Rechazando..." : "Rechazar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Botón para completar estudio */}
      <Dialog
        open={isOpen && actionType === "complete"}
        onOpenChange={setIsOpen}
      >
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpen("complete")}
            className="w-full"
          >
            <CheckCircle className="h-4 w-4" />
            Estudio manual
          </Button>
        </DialogTrigger>
        <DialogContent
          aria-describedby={undefined}
          className="w-full max-w-3xl max-h-[95dvh] h-full overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-primary-800">
              Completar Estudio - {formatUUID(comparativa.id)} ·{" "}
              {comparativa.client}
            </DialogTitle>
            <DialogDescription>
              Sube los archivos del estudio y asigna las comisiones
              correspondientes
            </DialogDescription>
          </DialogHeader>

          {loading && (
            <LoadingStateModal
              title="Completando estudio..."
              description="Espere unos segundos mientras procesamos el estudio."
            />
          )}

          <div className="space-y-6">
            {/* Subir archivos */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-900">
                Archivos del Estudio{" "}
                <span className="text-red-500 text-xs">*</span>
              </h3>
              <DocumentsForm
                uploadedFiles={uploadedFiles}
                setUploadedFiles={setUploadedFiles}
              />
              {uploadedFiles.length === 0 && (
                <p className="text-xs text-red-500">
                  Debes subir al menos un archivo para completar el estudio
                </p>
              )}
            </div>

            <Separator />

            {/* Seleccionar Comercializadora */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-900">
                Comercializadora Ganadora{" "}
                <span className="text-red-500 text-xs">*</span>
              </h3>
              <div className="space-y-2">
                <Label
                  htmlFor="supplier-select"
                  className="text-sm text-gray-600"
                >
                  Selecciona la comercializadora que ganó la comparativa
                </Label>
                <Select
                  value={selectedSupplierId}
                  onValueChange={setSelectedSupplierId}
                >
                  <SelectTrigger id="supplier-select" className="w-full">
                    <SelectValue placeholder="Seleccionar comercializadora..." />
                  </SelectTrigger>
                  <SelectContent>
                    {activeSuppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!selectedSupplierId && (
                  <p className="text-xs text-red-500">
                    Debes seleccionar una comercializadora para completar el
                    estudio
                  </p>
                )}
              </div>
            </div>

            <Separator />

            {/* Comisiones */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-900">
                Asignar Comisiones{" "}
                <span className="text-red-500 text-xs">*</span>
              </h3>
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
                <p className="text-sm text-gray-500">
                  Para completar el estudio, es necesario asignar todas las
                  comisiones.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={onClose} variant="outline">
              Cancelar
            </Button>
            <Button
              onClick={handleCompleteEstudio}
              disabled={
                uploadedFiles.length === 0 ||
                checkEmptyComissions() ||
                !selectedSupplierId ||
                loading
              }
            >
              {loading ? "Completando..." : "Completar Estudio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
