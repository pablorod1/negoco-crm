import { DocumentacionFile, User } from "@/lib/core/types";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import { Button } from "@heroui/react";
import { AlertTriangle, CheckCircle, CircleX } from "lucide-react";
import { showCustomToast } from "../core/CustomToast";
import { useDocumentacion } from "@/contexts/DocumentacionContext";

export default function DeleteFileConfirmationModal({
  file,
  userData,
  isOpen,
  onClose,
}: {
  file: DocumentacionFile;
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
          folder_path: file.folder_name,
          file_name: file.name,
          file_id: file.id,
          organization_id: userData.organization.id,
        }),
      });

      const { success, errors } = await res.json();

      if (!success) {
        showCustomToast({
          title: "Error eliminando archivo",
          message: errors,
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: CircleX,
        });
        return;
      }

      showCustomToast({
        title: "Archivo eliminado",
        message: "El archivo ha sido eliminado correctamente",
        iconColor: "var(--success-color)",
        iconSize: 24,
        icon: CheckCircle,
      });
      refreshDocumentacion();
    } catch (error) {
      console.error("Error eliminando archivo:", error);
      showCustomToast({
        title: "Error eliminando archivo",
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
          <AlertTriangle className="size-12 text-[var(--danger-color)]" />
          <div className="flex flex-col">
            <h2 className="text-lg font-semibold text-[var(--danger-color)]">
              ¿Estás seguro de que deseas eliminar el archivo?
            </h2>
            <p className="text-gray-600 text-sm">
              Se eliminará el archivo de forma permanente. Si la carpeta queda
              vacía, también se eliminará.
            </p>
          </div>
        </ModalHeader>
        <ModalBody className="flex justify-end gap-4 mt-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">Nombre:</h3>
              <p className="text-gray-600">{file.name}</p>
            </div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">Carpeta:</h3>
              <p className="text-gray-600">{file.folder_name}</p>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" color="default" onPress={onClose}>
            Cancelar
          </Button>
          <Button color="danger" onPress={handleDelete}>
            Eliminar Archivo
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
