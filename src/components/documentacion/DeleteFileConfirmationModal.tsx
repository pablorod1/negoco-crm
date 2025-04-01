"use client";
import { DocumentacionFile, User } from "@/lib/core/types";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import { Button } from "@heroui/button";
import { AlertTriangle, CheckCircle, CircleX } from "lucide-react";
import { showCustomToast } from "../core/CustomToast";
import { useDocumentacion } from "@/lib/contexts/DocumentacionContext";

export default function DeleteFileConfirmationModal({
  files,
  userData,
  isOpen,
  onClose,
}: {
  files: DocumentacionFile[];
  userData: User;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { refreshDocumentacion } = useDocumentacion();

  const handleDelete = async () => {
    try {
      const res = await fetch("/api/documentacion/delete/file", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          files: files.map((file) => ({
            folder_path: file.folder_name,
            file_name: file.name,
            file_id: file.id,
            organization_id: userData.organization.id,
          })),
        }),
      });

      const { success, error } = await res.json();

      if (!success) {
        showCustomToast({
          title: "Error eliminando archivos",
          message: error,
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: CircleX,
        });
        return;
      }

      showCustomToast({
        title: files.length > 1 ? "Archivos eliminados" : "Archivo eliminado",
        message:
          files.length > 1
            ? "Los archivos han sido eliminados correctamente"
            : "El archivo ha sido eliminado correctamente",
        iconColor: "var(--success-color)",
        iconSize: 24,
        icon: CheckCircle,
      });
      refreshDocumentacion();
      onClose();
    } catch (error) {
      console.error("Error eliminando archivos:", error);
      showCustomToast({
        title: "Error eliminando archivos",
        message: "Inténtalo de nuevo más tarde",
        iconColor: "var(--danger-color)",
        iconSize: 24,
        icon: CircleX,
      });
    }
  };

  return (
    <Modal
      hideCloseButton
      isDismissable={false}
      inert={!isOpen}
      size="2xl"
      isOpen={isOpen}
      onClose={onClose}
    >
      <ModalContent>
        <ModalHeader className="flex items-start gap-4">
          <AlertTriangle className="size-12 text-danger" />
          <div className="flex flex-col">
            <h2 className="text-lg font-semibold text-danger">
              {files.length > 1
                ? `¿Estás seguro de que deseas eliminar ${files.length} archivos?`
                : "¿Estás seguro de que deseas eliminar el archivo?"}
            </h2>
            <p className="text-gray-600 text-sm">
              {files.length > 1
                ? "Se eliminarán los archivos de forma permanente."
                : "Se eliminará el archivo de forma permanente."}
              Si alguna carpeta queda vacía, también se eliminará.
            </p>
          </div>
        </ModalHeader>
        <ModalBody className="flex flex-col gap-4 mt-2">
          {files.length > 1 ? (
            <div className="max-h-60 overflow-y-auto border rounded-md p-2">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">
                      Nombre
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">
                      Carpeta
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file, index) => (
                    <tr
                      key={file.id}
                      className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                    >
                      <td className="px-3 py-2">{file.name}</td>
                      <td className="px-3 py-2">{file.folder_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">Nombre:</h3>
                <p className="text-gray-600">{files[0]?.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">Carpeta:</h3>
                <p className="text-gray-600">{files[0]?.folder_name}</p>
              </div>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="light" color="primary" onPress={onClose} radius="sm">
            Cancelar
          </Button>
          <Button color="danger" onPress={handleDelete} radius="sm">
            {files.length > 1 ? "Eliminar Archivos" : "Eliminar Archivo"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
