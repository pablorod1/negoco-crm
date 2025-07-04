"use client";
import { Button } from "@/core/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@/core/components/ui/dialog";
import DocumentsForm from "@/tramites/components/DocumentsForm";
import React, { useState } from "react";

import { CheckCircle, CircleX, FilePlus2 } from "lucide-react";
import { showCustomToast } from "@/core/components/CustomToast";
import LoadingStateModal from "@/core/components/LoadingStateModal";
import { generateTramiteUpdatedNotification } from "@/core/utils/notifications.helpers";
import { ClientDB, TramiteFile } from "@/tramites/types";
import { User } from "@/core/types";
import { uploadFile } from "@/core/firebase/data/uploadFiles";

interface Props {
  onUpload: () => void;
  tramite_id: string;
  organization_id: string;
  user_id: string;
  userData: User;
  client: ClientDB;
}

export default function UploadTramiteFilesModal({
  onUpload,
  tramite_id,
  organization_id,
  user_id,
  userData,
  client,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  const onOpen = () => setIsOpen(true);
  const onClose = () => setIsOpen(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const tramiteFiles: TramiteFile[] = [];

      if (uploadedFiles.length > 0) {
        for (const file of uploadedFiles) {
          try {
            const { downloadURL, previewURL } = await uploadFile(
              file,
              `${organization_id}/tramites`,
              tramite_id
            );

            tramiteFiles.push({
              id: crypto.randomUUID(),
              tramite_id,
              filename: file.name,
              size: file.size,
              extension: file.name.split(".").pop() as string,
              upload_date: new Date().toISOString(),
              download_url: downloadURL,
              preview_url: previewURL || null,
            });
          } catch (error) {
            console.error("Error al subir archivo:", error);
            showCustomToast({
              title: "Error subiendo archivo",
              message: "No se pudo subir el archivo",
              icon: CircleX,
              iconColor: "var(--danger-color)",
              iconSize: 24,
            });
            return;
          }
        }
      }
      const formData = new FormData();
      formData.append("files", JSON.stringify(tramiteFiles));
      formData.append("userData", JSON.stringify(userData));
      const res = await fetch("/api/tramites/add/files", {
        method: "POST",
        body: formData,
      });

      const { success, error } = await res.json();

      if (!success) {
        showCustomToast({
          title: "Error subiendo archivos",
          message: error,
          icon: CircleX,
          iconColor: "var(--danger-color)",
          iconSize: 24,
        });
        return;
      }

      const notification = generateTramiteUpdatedNotification({
        uploadedFiles,
        client: `${client.name} ${client.last_name}`,
        tramite_id,
        user_id,
      });

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
          title: "Error creando notificación",
          message: notificationError,
          icon: CircleX,
          iconColor: "var(--danger-color)",
          iconSize: 24,
        });
        return;
      }

      showCustomToast({
        title: "Archivos subidos",
        message: `Los archivos se han subido correctamente. Se ha notificado de los cambios en el trámite`,
        icon: CheckCircle,
        iconColor: "var(--success-color)",
        iconSize: 24,
      });

      onUpload();
      setUploadedFiles([]);
      onClose();
    } catch (error) {
      console.error("Error subiendo archivos:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setUploadedFiles([]);
    onClose();
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
        <DialogContent className="w-full max-w-2xl">
          <DialogHeader aria-describedby={undefined}>
            <DialogTitle className="text-2xl font-bold text-primary-800">
              Subir Archivos
            </DialogTitle>
          </DialogHeader>
          {loading && (
            <LoadingStateModal
              title="Subiendo archivos..."
              description="Espere unos segundos mientras se suben los archivos al trámite."
            />
          )}
          <DocumentsForm
            uploadedFiles={uploadedFiles}
            setUploadedFiles={setUploadedFiles}
          />
          <DialogFooter>
            <Button onClick={handleCancel} variant="destructive">
              Cancelar
            </Button>
            <Button onClick={handleSubmit}>Subir Archivos</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
