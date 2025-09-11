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
import LoadingStateModal from "@/core/components/LoadingStateModal";
import { uploadFile } from "@/core/firebase/data/uploadFiles";

interface Props {
  onUpload: () => void;
  userData: User;
  comparativa: ComparativaVM;
}

export default function UploadComparativaFilesModal({
  onUpload,
  userData,
  comparativa,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const organization_id = userData.organization.id;

  const onClose = () => {
    setIsOpen(false);
    setUploadedFiles([]);
  };

  const onOpen = () => {
    setIsOpen(true);
    setUploadedFiles([]);
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
      formData.append("files", JSON.stringify(comparativaFiles));
      formData.append("user_id", userData.id);

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

      // Notificación de archivos añadidos
      const notification: Notification = generateComparativaUpdatedNotification(
        {
          comparativa_id: comparativa.id,
          client: comparativa.client,
          user_id: comparativa.user.id as string,
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
        console.warn("Error al enviar notificación:", NotificationError);
      }

      showCustomToast({
        title: "Archivos subidos correctamente",
        message: `Se han añadido ${comparativaFiles.length} archivo${comparativaFiles.length !== 1 ? "s" : ""} a la comparativa.`,
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

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button onClick={onOpen} variant="outline">
            <FilePlus2 size={16} />
            Añadir Archivo
          </Button>
        </DialogTrigger>
        <DialogContent
          aria-describedby={undefined}
          className="w-full max-w-2xl"
        >
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-primary-800">
              Añadir Archivos
            </DialogTitle>
          </DialogHeader>
          {loading && (
            <LoadingStateModal
              title="Subiendo archivos..."
              description="Espere unos segundos mientras subimos los archivos a la comparativa."
            />
          )}
          <div className="space-y-4">
            <DocumentsForm
              uploadedFiles={uploadedFiles}
              setUploadedFiles={setUploadedFiles}
            />

            {uploadedFiles.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                Selecciona archivos para subir a la comparativa
              </p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={onClose} variant="outline">
              Cancelar
            </Button>
            <Button
              disabled={uploadedFiles.length === 0 || loading}
              onClick={handleSubmit}
            >
              {loading
                ? "Subiendo..."
                : `Subir ${uploadedFiles.length} archivo${uploadedFiles.length !== 1 ? "s" : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
