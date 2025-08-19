import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/core/components/ui/dialog";
import { Button } from "@/core/components/ui/button";
import DocumentsForm from "@/tramites/components/DocumentsForm";
import { useState } from "react";
import { Notification, User } from "@/core/types";
import { InputComponent } from "@/tramites/components/createTramite/InputComponent";
import { Separator } from "@/core/components/ui/separator";
import { Checkbox } from "@/core/components/ui/checkbox";
import { Label } from "@/core/components/ui/label";
import ButtonGroupComponent from "@/core/components/ButtonGroupComponent";
import { uploadFile } from "@/core/firebase/data/uploadFiles";
import { CheckCircle, CircleX } from "lucide-react";
import { showCustomToast } from "@/core/components/CustomToast";
import { generateFotovoltaicaUpdatedNotification } from "@/core/utils/notifications.helpers";
import { FotovoltaicaFile, FotovoltaicaVM } from "@/fotovoltaica/types";

interface Props {
  fotovoltaica: FotovoltaicaVM;
  userData: User;
  onSubmit: () => void;
}

export default function UploadFotovoltaicaFilesDialog({
  fotovoltaica,
  userData,
  onSubmit,
}: Props) {
  const [formData, setFormData] = useState<{
    comision: number;
    comision_sales_person: number;
  }>({
    comision: fotovoltaica.comision || 0,
    comision_sales_person: fotovoltaica.comision_sales_person || 0,
  });
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isCompleted, setIsCompleted] = useState(true);
  const isProcessing = fotovoltaica.status === "processing";
  const organizationId = userData.organization.id;

  const onOpen = () => setIsOpen(true);
  const onClose = () => setIsOpen(false);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value ? parseFloat(value) : 0,
    }));
  };

  const handleCheckboxChange = (checked: boolean) => {
    setIsCompleted(checked);
  };

  const checkComissionsEmpty = () => {
    return formData.comision === 0 || formData.comision_sales_person === 0;
  };

  const handleSubmit = async () => {
    setLoading(true);

    if (isCompleted && checkComissionsEmpty()) {
      showCustomToast({
        title: "Comisiones incompletas",
        message: "Por favor, completa las comisiones antes de continuar.",
        iconColor: "var(--danger-color)",
        iconSize: 24,
        icon: CircleX,
      });
      setLoading(false);
      return;
    }

    try {
      const fotovoltaicaFiles: FotovoltaicaFile[] = [];

      if (uploadedFiles.length > 0) {
        for (const file of uploadedFiles) {
          try {
            const { downloadURL, previewURL } = await uploadFile(
              file,
              `${organizationId}/fotovoltaicas`,
              fotovoltaica.id
            );

            fotovoltaicaFiles.push({
              id: crypto.randomUUID(),
              fotovoltaica_id: fotovoltaica.id,
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

      const formDataToSend = new FormData();
      formDataToSend.append("files", JSON.stringify(fotovoltaicaFiles));
      if (isCompleted) {
        const comissionsData = {
          comision: formData.comision,
          comision_sales_person: formData.comision_sales_person,
        };
        formDataToSend.append("status", "completed");
        formDataToSend.append("comissions", JSON.stringify(comissionsData));
      }

      const response = await fetch(
        `/api/v2/solar-installations/${fotovoltaica.id}/documents`,
        {
          method: "POST",
          body: formDataToSend,
        }
      );

      const { success, error } = await response.json();

      if (!success) {
        showCustomToast({
          title: "Error al subir archivos",
          message: error || "No se pudieron subir los archivos.",
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: CircleX,
        });
        setLoading(false);
        return;
      }

      const notification: Notification =
        generateFotovoltaicaUpdatedNotification({
          fotovoltaica_id: fotovoltaica.id,
          client: fotovoltaica.client,
          user_id: fotovoltaica.user_id,
          status: isCompleted ? "completed" : undefined,
          files: uploadedFiles.length > 0,
        });

      const notificationResponse = await fetch(`/api/v2/notifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notification }),
      });

      const { success: notificationSuccess, error: notificationError } =
        await notificationResponse.json();

      if (!notificationSuccess && notificationError) {
        showCustomToast({
          title: "Error al notificar cambios",
          message: notificationError,
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: CircleX,
        });
        return;
      }

      if (isCompleted) {
        const emailRes = await fetch(
          `/api/v2/communications/emails/status-updates`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "fotovoltaica",
              user_to: {
                email: fotovoltaica.user.email,
                name: fotovoltaica.user.name,
                org_logo: userData.organization.logo,
              },
              fotovoltaica_id: fotovoltaica.id,
              client: fotovoltaica.client,
              status: {
                old: fotovoltaica.status,
                new: "completed",
              },
            }),
          }
        );

        const { success: emailSuccess, error: emailError } =
          await emailRes.json();

        if (!emailSuccess) {
          showCustomToast({
            title: "Error al enviar el email",
            message:
              emailError || "No se pudo enviar el correo de notificación.",
            icon: CircleX,
            iconSize: 24,
            iconColor: "var(--danger-color)",
          });
          return;
        }
      }

      showCustomToast({
        title: "Archivos subidos correctamente",
        message: "Los archivos se han subido exitosamente.",
        iconColor: "var(--success-color)",
        iconSize: 24,
        icon: CheckCircle,
      });
      onSubmit();
      onClose();
    } catch (error) {
      console.error("Error uploading files:", error);
      showCustomToast({
        title: "Error al subir archivos",
        message: "Inténtalo de nuevo más tarde",
        iconColor: "var(--danger-color)",
        iconSize: 24,
        icon: CircleX,
      });
      return;
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Subir Archivos</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl space-y-6">
        <DialogHeader>
          <DialogTitle className="text-primary-800">
            Subir Archivos Fotovoltaica
          </DialogTitle>
          <DialogDescription>
            Selecciona los archivos que deseas subir para la fotovoltaica.
          </DialogDescription>
        </DialogHeader>
        <DocumentsForm
          uploadedFiles={uploadedFiles}
          setUploadedFiles={setUploadedFiles}
        />
        {isProcessing ? (
          <>
            <Separator />

            <div className="space-y-6">
              <p className="text-sm">
                El estado de la solicitud pasará a <strong>Completada </strong>
                una vez que se hayan subido los archivos necesarios y se haya
                asignado una comisión.
              </p>
              <p className="text-sm">
                Asegúrate de que todos los archivos requeridos estén
                correctamente adjuntos antes de completar el proceso.
              </p>
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={isCompleted}
                  onCheckedChange={handleCheckboxChange}
                  id="confirm"
                />
                <Label htmlFor="confirm">
                  Si quieres manterer la solicitud en estado{" "}
                  <strong>Procesando </strong>
                  desmarca la casilla.
                </Label>
              </div>
            </div>
          </>
        ) : null}
        {isProcessing && isCompleted ? (
          <>
            <Separator />
            <div className="flex gap-4 w-full">
              <InputComponent
                label="Comisión"
                name="comision"
                placeholder="Ingrese una comisión"
                onChange={handleInputChange}
                isRequired
                type="number"
                value={formData.comision}
              />

              <InputComponent
                label="Comisión Comercial"
                name="comision_sales_person"
                placeholder="Ingrese la comisión del comercial"
                onChange={handleInputChange}
                isRequired
                type="number"
                value={formData.comision_sales_person}
              />
            </div>
          </>
        ) : null}
        <DialogFooter>
          <ButtonGroupComponent
            onSubmit={handleSubmit}
            onCancel={onClose}
            loading={loading}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
