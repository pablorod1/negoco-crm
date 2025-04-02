import {
  Modal,
  ModalHeader,
  ModalContent,
  ModalFooter,
  ModalBody,
  useDisclosure,
} from "@heroui/modal";
import { Button } from "@heroui/button";
import { AlertTriangle, CloudAlert, Trash } from "lucide-react";
import { showCustomToast } from "@/components/core/CustomToast";
import { memo } from "react";

interface Props {
  comparativa_id: string;
  organization_id: string;
  filename: string;
  onDeleted: () => void;
}

const DeleteComparativaFileConfirmationModal = memo(
  ({ comparativa_id, organization_id, filename, onDeleted }: Props) => {
    const { isOpen, onOpen, onClose } = useDisclosure();

    const handleDeleteFile = async () => {
      try {
        const res = await fetch("/api/comparativas/delete/file", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            file_name: filename,
            comparativa_id,
            organization_id,
          }),
        });

        const { success, error } = await res.json();

        if (!success) {
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
          message: "El archivo se ha eliminado correctamente",
          iconColor: "var(--success-color)",
          iconSize: 24,
          icon: CloudAlert,
        });
        onDeleted();
      } catch (error) {
        console.error(error);
        showCustomToast({
          title: "Error al eliminar el archivo",
          message: "Error al eliminar el archivo",
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

DeleteComparativaFileConfirmationModal.displayName =
  "DeleteComparativaFileConfirmationModal";
export default DeleteComparativaFileConfirmationModal;
