"use client";
import { Button } from "@/core/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTrigger,
  DialogTitle,
} from "@/core/components/ui/dialog";
import DocumentsForm from "@/tramites/components/DocumentsForm";
import React, { useState } from "react";
import { showCustomToast } from "@/core/components/CustomToast";
import { CheckCircle, CircleX, FilePlus2 } from "lucide-react";
import {
  ComparativaFile,
  ComparativaVM,
} from "@/comparativas/types/comparativa.types";
import { Notification, User } from "@/core/types";
import { generateComparativaUpdatedNotification } from "@/core/utils/notifications.helpers";
import ComissionsForm, { ComissionFormValues } from "./ComissionsForm";
import LoadingStateModal from "@/core/components/LoadingStateModal";
import { uploadFile } from "@/core/firebase/data/uploadFiles";
import { Separator } from "@/core/components/ui/separator";
import { Checkbox } from "@/core/components/ui/checkbox";
import { CheckedState } from "@radix-ui/react-checkbox";
import { Label } from "@/core/components/ui/label";

interface Props {
  onUpload: () => void;
  status: string;
  userData: User;
  comparativa: ComparativaVM;
}

export default function UploadComparativaFilesModal({
  onUpload,
  status,
  userData,
  comparativa,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [estudioRealizado, setEstudioRealizado] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
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
  const isAdmin = userData && userData.role === "admin";
  const isBackoffice = userData && userData.role === "1";
  const organization_id = userData.organization.id;

  const onClose = () => {
    setIsOpen(false);
    setUploadedFiles([]);
    setEstudioRealizado(false);
  };

  const onOpen = () => {
    setIsOpen(true);
    setEstudioRealizado(comparativa.status === "completed" ? true : false);
    setUploadedFiles([]);
  };

  const checkStatusChanged = () => {
    if (comparativa.status === "pending" && estudioRealizado) {
      return true;
    }
    if (comparativa.status === "completed" && !estudioRealizado) {
      return true;
    }
    return false;
  };

  const handleCheck = (check: CheckedState) => {
    setEstudioRealizado(check as boolean);
  };

  const formatStatus = (status: string) => {
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

  const handleSubmit = async () => {
    if (!userData) {
      return;
    }
    setLoading(true);
    try {
      const comparativaFiles: ComparativaFile[] = [];

      if (uploadedFiles.length > 0) {
        for (const file of uploadedFiles) {
          try {
            const { downloadURL, previewURL } = await uploadFile(
              file,
              `${organization_id}/comparativas`,
              comparativa.id
            );

            comparativaFiles.push({
              id: crypto.randomUUID(),
              comparativa_id: comparativa.id,
              filename: file.name,
              size: file.size,
              extension: file.name.split(".").pop() as string,
              upload_date: new Date().toISOString(),
              download_url: downloadURL,
              preview_url: previewURL || null,
            });
          } catch (error) {
            console.error("Error uploading file:", error);
            showCustomToast({
              title: "Error al subir archivos",
              message: "Inténtalo de nuevo más tarde",
              iconColor: "var(--danger-color)",
              iconSize: 24,
              icon: CircleX,
            });
            return;
          }
        }
      }

      const formData = new FormData();
      formData.append("organization_id", organization_id);
      const comissionsData = {
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

      const isComissionsNotEmpty = Object.values(comissionsData).some(
        (value) => value !== undefined
      );

      if (isComissionsNotEmpty) {
        formData.append("comissions", JSON.stringify(comissionsData));
      }

      formData.append("files", JSON.stringify(comparativaFiles));
      formData.append("estudio_realizado", estudioRealizado.toString());
      const response = await fetch(
        `/api/v2/comparisons/${comparativa.id}/documents`,
        {
          method: "POST",
          body: formData,
        }
      );

      const { success, error } = await response.json();

      if (!success) {
        showCustomToast({
          title: "Error al subir archivos",
          message: error,
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: CircleX,
        });
        return;
      }

      const notification: Notification = generateComparativaUpdatedNotification(
        {
          comparativa_id: comparativa.id,
          client: comparativa.client,
          user_id: comparativa.user.id as string,
          status: estudioRealizado ? "Estudio Realizado" : undefined,
          files: true,
        }
      );

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

      if (checkStatusChanged()) {
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
              status: {
                old: formatStatus(comparativa.status),
                new: estudioRealizado
                  ? "Estudio Realizado"
                  : "Pendiente de Estudio",
              },
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
        title: "Archivos subidos correctamente",
        message: `Comparativa actualizada correctamente.\n\n
          Se ha notificado a ${comparativa.user.name} de los cambios.
        `,
        iconColor: "var(--success-color)",
        icon: CheckCircle,
        iconSize: 24,
      });
      onUpload();
      onClose();
    } catch (error) {
      showCustomToast({
        title: "Error al subir archivos",
        message: "Inténtalo de nuevo más tarde",
        iconColor: "var(--danger-color)",
        iconSize: 24,
        icon: CircleX,
      });
      console.error("Error subiendo archivos:", error);
    } finally {
      setLoading(false);
    }
  };

  const getCheckboxLabelText = () => {
    if (comparativa.status === "pending" && estudioRealizado) {
      return "El estado de la comparativa cambiará a 'Estudio Realizado' una vez que subas los archivos.";
    } else if (comparativa.status === "completed" && !estudioRealizado) {
      return "El estado de la comparativa cambiará a 'Pendiente de Estudio' una vez que subas los archivos.";
    } else if (comparativa.status === "completed" && estudioRealizado) {
      return "El estado de la comparativa se mantendrá como 'Estudio Realizado'.";
    }
    return "El estado de la comparativa se mantendrá como 'Pendiente de Estudio'.";
  };

  return (
    <>
      <Dialog open={isOpen}>
        <DialogTrigger asChild>
          <Button onClick={onOpen} variant="outline">
            <FilePlus2 size={16} />
            Añadir Archivo
          </Button>
        </DialogTrigger>
        <DialogContent
          aria-describedby={undefined}
          className="w-full max-w-3xl"
        >
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-primary-800">
              Subir Archivos
            </DialogTitle>
          </DialogHeader>
          {loading && (
            <LoadingStateModal
              title="Subiendo archivos..."
              description="Espere unos segundos mientras subimos los archivos a la comparativa."
            />
          )}
          <DocumentsForm
            uploadedFiles={uploadedFiles}
            setUploadedFiles={setUploadedFiles}
          />
          {(isAdmin || isBackoffice) && (
            <>
              <Separator />
              <div className="space-y-4">
                <div className="space-y-2">
                  {status === "pending" ? (
                    <>
                      <h2 className="text-lg font-semibold text-primary-800">
                        ¿Has realizado el estudio de esta comparativa?
                      </h2>
                      <p className="text-sm text-gray-600">
                        El estado de la comparativa cambiará a{" "}
                        <strong>Estudio Realizado</strong> una vez que subas los
                        archivos.
                      </p>
                      <p className="text-sm text-gray-600">
                        Para mantener el estado en{" "}
                        <strong>Pendiente de Estudio</strong>, desmarca la
                        casilla.
                      </p>
                    </>
                  ) : (
                    <>
                      <h2 className="text-lg font-semibold text-primary-800">
                        El estudio de esta comparativa ya ha sido realizado.
                      </h2>
                      <p className="text-sm text-gray-600">
                        Si deseas cambiar el estado de la comparativa a{" "}
                        <strong>Pendiente de Estudio</strong>, desmarca la
                        casilla.
                      </p>
                      <p className="text-sm text-gray-600">
                        Si deseas mantener el estado de la comparativa como{" "}
                        <strong>Estudio Realizado</strong>, déjala marcada.
                      </p>
                    </>
                  )}
                </div>
                <div className="inline-flex gap-2">
                  <Checkbox
                    className="rounded-md"
                    color="primary"
                    onCheckedChange={handleCheck}
                    checked={estudioRealizado}
                    id="estudioRealizado"
                    name="estudioRealizado"
                  />
                  <Label htmlFor="estudioRealizado">
                    {getCheckboxLabelText()}
                  </Label>
                </div>

                {estudioRealizado && (
                  <>
                    <Separator />
                    <ComissionsForm
                      comparativa={comparativa}
                      formDataComissions={formDataComissions}
                      setFormDataComissions={setFormDataComissions}
                    />
                  </>
                )}
              </div>
            </>
          )}
          <DialogFooter>
            <Button onClick={onClose} variant="destructive">
              Cancelar
            </Button>
            <Button
              disabled={uploadedFiles.length === 0}
              onClick={handleSubmit}
            >
              Subir Archivos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
