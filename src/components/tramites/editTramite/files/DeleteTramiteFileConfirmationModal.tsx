import {
  Modal,
  ModalHeader,
  ModalContent,
  ModalFooter,
  ModalBody,
  useDisclosure,
} from "@heroui/modal";
import { Button } from "@heroui/button";
import { AlertTriangle, CheckCircle, CloudAlert, Trash } from "lucide-react";
import { showCustomToast } from "@/components/core/CustomToast";
import { memo } from "react";
import { deleteFileFromStorage } from "@/lib/firebase/data/deleteFile";

interface DeleteFileConfirmationModalProps {
  tramite_id: string;
  organization_id: string;
  filename: string;
  onDeleted: () => void;
}

const DeleteTramiteFileConfirmationModal = memo(
  ({
    tramite_id,
    organization_id,
    filename,
    onDeleted,
  }: DeleteFileConfirmationModalProps) => {
    const { isOpen, onOpen, onClose } = useDisclosure();

    const handleDeleteFile = async () => {
      try {
        const { success, error } = await deleteFileFromStorage(
          `tramites`,
          tramite_id,
          filename,
          organization_id
        );

        if (!success) {
          console.error(error);
          showCustomToast({
            title: "Error al eliminar el archivo",
            message: error,
            iconColor: "var(--danger-color)",
            iconSize: 24,
            icon: CloudAlert,
          });
          return;
        }

        showCustomToast({
          title: "Archivo eliminado",
          message: `El archivo ${filename} ha sido eliminado.`,
          iconColor: "var(--success-color)",
          iconSize: 24,
          icon: CheckCircle,
        });
        onDeleted();
        onClose();
      } catch (error) {
        console.error(error);
        showCustomToast({
          title: "Error al eliminar el archivo",
          message: "Ocurrió un error al eliminar el archivo.",
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: CloudAlert,
        });
      }
    };

    return (
      <>
        <Button
          size="sm"
          variant="light"
          color="danger"
          isIconOnly
          onPress={onOpen}
        >
          <Trash size={20} />
        </Button>
        <Modal size="2xl" isOpen={isOpen} onClose={onClose}>
          <ModalContent>
            <ModalHeader className="flex items-start gap-4">
              <AlertTriangle className="size-12 text-danger" />
              <div className="flex flex-col">
                <h2 className="text-lg font-semibold text-danger">
                  ¿Estás seguro de que deseas eliminar el archivo?
                </h2>
                <p className="text-gray-600 text-sm">
                  Se eliminará de forma permanente.
                </p>
              </div>
            </ModalHeader>
            <ModalBody className="flex justify-end gap-4 mt-4">
              <span>{filename}</span>
            </ModalBody>
            <ModalFooter>
              <Button color="default" onPress={onClose}>
                Cancelar
              </Button>
              <Button
                variant="solid"
                radius="sm"
                color="danger"
                onPress={handleDeleteFile}
              >
                Eliminar Archivo
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </>
    );
  }
);

DeleteTramiteFileConfirmationModal.displayName =
  "DeleteTramiteFileConfirmationModal";
export default DeleteTramiteFileConfirmationModal;
