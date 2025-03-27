import {
  Modal,
  ModalHeader,
  ModalContent,
  ModalFooter,
  ModalBody,
  useDisclosure,
} from "@heroui/modal";
import { Button } from "@heroui/button";
import { AlertTriangle, CheckCircle, CircleX, Trash } from "lucide-react";
import { showCustomToast } from "@/components/core/CustomToast";
import { memo } from "react";

interface DeleteNoteConfirmationModalProps {
  note: string;
  notes: string[];
  tramite_id: string;
  onDeleted: () => void;
}

const DeleteTramiteNoteConfirmationModal = memo(
  ({
    note,
    notes,
    tramite_id,
    onDeleted,
  }: DeleteNoteConfirmationModalProps) => {
    const { isOpen, onOpen, onClose } = useDisclosure();

    const handleDelete = async () => {
      try {
        const rs = await fetch(`/api/tramites/delete/note`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ note, id: tramite_id, notes }),
        });

        const { success, error } = await rs.json();

        if (!success) {
          showCustomToast({
            title: "Error",
            message: error,
            icon: CircleX,
            iconSize: 24,
            iconColor: "var(--danger-color)",
          });
          return;
        }

        showCustomToast({
          title: "Nota eliminada",
          message: `La nota ha sido eliminada correctamente`,
          icon: CheckCircle,
          iconSize: 24,
          iconColor: "var(--success-color)",
        });
      } catch (error) {
        console.error("Error al eliminar la nota:", error);
        showCustomToast({
          title: "Error",
          message: "Error al eliminar la nota",
          icon: CircleX,
          iconSize: 24,
          iconColor: "var(--danger-color)",
        });
      } finally {
        onDeleted();
        onClose();
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
          <Trash size={16} />
        </Button>
        <Modal size="2xl" isOpen={isOpen} onClose={onClose}>
          <ModalContent>
            <ModalHeader className="flex items-start gap-4">
              <AlertTriangle className="size-12 text-danger" />
              <div className="flex flex-col">
                <h2 className="text-lg font-semibold text-danger">
                  ¿Estás seguro de que deseas eliminar la nota?
                </h2>
                <p className="text-gray-600 text-sm">
                  Se eliminará de forma permanente.
                </p>
              </div>
            </ModalHeader>
            <ModalBody className="flex justify-end gap-4 mt-4">
              <span>{note}</span>
            </ModalBody>
            <ModalFooter>
              <Button color="default" onPress={onClose}>
                Cancelar
              </Button>
              <Button
                variant="solid"
                radius="sm"
                color="danger"
                onPress={handleDelete}
              >
                Eliminar nota
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </>
    );
  }
);

DeleteTramiteNoteConfirmationModal.displayName =
  "DeleteTramiteNoteConfirmationModal";

export default DeleteTramiteNoteConfirmationModal;
