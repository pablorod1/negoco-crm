"use client";
import { Button } from "@heroui/button";
import {
  useDisclosure,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import DocumentsForm from "@/components/tramites/DocumentsForm";
import React, { useState } from "react";

import { Bell, CircleX, FilePlus2 } from "lucide-react";
import { showCustomToast } from "@/components/core/CustomToast";
import LoadingStateModal from "@/components/core/LoadingStateModal";
import { generateTramiteUpdatedNotification } from "@/lib/core/notifications.helpers";
import { User } from "@/lib/core/types";

interface Props {
  onUpload: () => void;
  tramite_id: string;
  organization_id: string;
  user_id: string;
  userData: User;
}

export default function UploadTramiteFilesModal({
  onUpload,
  tramite_id,
  organization_id,
  user_id,
  userData,
}: Props) {
  const { isOpen, onClose, onOpen } = useDisclosure();
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const formData = new FormData();
      uploadedFiles.forEach((file) => {
        formData.append("files", file);
      });
      formData.append("id", tramite_id);
      formData.append("organization_id", organization_id);
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

      const notification = generateTramiteUpdatedNotification(
        {},
        uploadedFiles,
        tramite_id,
        user_id
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
        icon: Bell,
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
      <Button
        startContent={<FilePlus2 size={16} />}
        onPress={onOpen}
        variant="bordered"
        color="primary"
        radius="sm"
      >
        Añadir Archivo
      </Button>
      <Modal
        isDismissable={false}
        hideCloseButton
        inert={!isOpen}
        size="3xl"
        isOpen={isOpen}
        onClose={onClose}
        radius="sm"
      >
        <ModalContent>
          <ModalHeader>
            <h2 className="text-2xl font-bold text-primary-800">
              Subir Archivos
            </h2>
          </ModalHeader>
          <ModalBody>
            {loading && <LoadingStateModal userData={userData} />}
            <DocumentsForm
              uploadedFiles={uploadedFiles}
              setUploadedFiles={setUploadedFiles}
            />
          </ModalBody>
          <ModalFooter>
            <Button
              radius="sm"
              color="danger"
              onPress={handleCancel}
              variant="light"
            >
              Cancelar
            </Button>
            <Button
              variant="solid"
              color="primary"
              radius="sm"
              onPress={handleSubmit}
            >
              Subir Archivos
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
