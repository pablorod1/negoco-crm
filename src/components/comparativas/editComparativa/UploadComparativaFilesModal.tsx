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
import { Divider } from "@heroui/divider";
import DocumentsForm from "../../tramites/createTramite/forms/DocumentsForm";
import { Checkbox } from "@heroui/checkbox";
import React, { useState } from "react";
import { showCustomToast } from "../../core/CustomToast";
import { CheckCircle, CircleX, FilePlus2 } from "lucide-react";
import { ComparativaVM, Notification, User } from "@/lib/core/types";
import { generateComparativaUpdatedNotification } from "@/lib/core/notifications.helpers";
import ComissionsForm from "./ComissionsForm";

interface Props {
  organization_id: string;
  onUpload: () => void;
  status: string;
  userData: User;
  comparativa: ComparativaVM;
}

export default function UploadComparativaFilesModal({
  organization_id,
  onUpload,
  status,
  userData,
  comparativa,
}: Props) {
  const { isOpen, onClose, onOpen } = useDisclosure();
  const [estudioRealizado, setEstudioRealizado] = useState(true);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [formDataComissions, setFormDataComissions] = useState({
    comision_fijo: comparativa.comision.fijo,
    comision_indexado: comparativa.comision.indexado,
    comision_sales_person_fijo: comparativa.comision_sales_person.fijo,
    comision_sales_person_indexado: comparativa.comision_sales_person.indexado,
  });
  const isAdmin = userData && userData.role === "admin";
  const isBackoffice = userData && userData.role === "1";

  const handleCancel = () => {
    setUploadedFiles([]);
    onClose();
  };

  const checkComissionsNotEmpty = () => {
    return (
      !formDataComissions.comision_fijo ||
      !formDataComissions.comision_indexado ||
      !formDataComissions.comision_sales_person_fijo ||
      !formDataComissions.comision_sales_person_indexado
    );
  };

  const handleSubmit = async () => {
    try {
      if (estudioRealizado && checkComissionsNotEmpty()) {
        showCustomToast({
          title: "Error al actualizar la comparativa",
          message:
            "Para completar el estudio debes asignar todas las comisiones",
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: CircleX,
        });
        return;
      }
      const formData = new FormData();
      formData.append("comparativa_id", comparativa.id);
      formData.append("organization_id", organization_id);
      formData.append(
        "comissions",
        JSON.stringify({
          comision_fijo:
            formDataComissions.comision_fijo !== comparativa.comision.fijo
              ? formDataComissions.comision_fijo
              : undefined,
          comision_indexado:
            formDataComissions.comision_indexado !==
            comparativa.comision.indexado
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
        })
      );
      uploadedFiles.forEach((doc) => {
        formData.append("files", doc);
      });
      formData.append("estudio_realizado", estudioRealizado.toString());
      const response = await fetch("/api/comparativas/update", {
        method: "POST",
        body: formData,
      });

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
        comparativa.id,
        comparativa.user.id as string,
        false,
        estudioRealizado ? "Estudio Realizado" : undefined,
        true
      );

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
    }
  };

  return (
    <>
      <Button
        startContent={<FilePlus2 size={16} />}
        onPress={onOpen}
        variant="light"
        color="primary"
        radius="sm"
        className="!bg-transparent"
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
            <h2 className="text-2xl font-bold text-[var(--primary-color-800)]">
              Subir Archivos
            </h2>
          </ModalHeader>
          <ModalBody>
            <DocumentsForm
              uploadedFiles={uploadedFiles}
              setUploadedFiles={setUploadedFiles}
            />
            {(isAdmin || isBackoffice) && (
              <>
                <Divider />
                <div className="space-y-4">
                  <div className="space-y-2">
                    {status === "pending" ? (
                      <>
                        <h2 className="text-lg font-semibold text-[var(--primary-color-800)]">
                          ¿Has realizado el estudio de esta comparativa?
                        </h2>
                        <p className="text-sm text-gray-600">
                          El estado de la comparativa cambiará a{" "}
                          <strong>Estudio Realizado</strong> una vez que subas
                          los archivos.
                        </p>
                        <p className="text-sm text-gray-600">
                          Para mantener el estado en{" "}
                          <strong>Pendiente de Estudio</strong>, desmarca la
                          casilla.
                        </p>
                      </>
                    ) : (
                      <>
                        <h2 className="text-lg font-semibold text-[var(--primary-color-800)]">
                          El estudio de esta comparativa ya ha sido realizado.
                        </h2>
                        <p className="text-sm text-gray-600">
                          Si deseas cambiar el estado de la comparativa a{" "}
                          <strong>Pendiente de Estudio</strong>, desmarca la
                          casilla.
                        </p>
                      </>
                    )}
                  </div>
                  <Checkbox
                    color="primary"
                    size="sm"
                    onValueChange={setEstudioRealizado}
                    isSelected={estudioRealizado}
                  >
                    {estudioRealizado
                      ? "Estudio Realizado"
                      : "Pendiente de Estudio"}
                  </Checkbox>
                  {estudioRealizado && (
                    <>
                      <Divider />
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
