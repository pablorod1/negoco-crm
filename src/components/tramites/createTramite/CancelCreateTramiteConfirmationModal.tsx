import { showCustomToast } from "@/components/core/CustomToast";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure,
} from "@heroui/modal";
import { Button } from "@heroui/button";
import { AlertTriangle, CircleX } from "lucide-react";

interface Props {
  onCancel: () => void;
}

export default function CancelCreateTramiteConfirmationModal({
  onCancel,
}: Props) {
  const { isOpen, onClose, onOpen } = useDisclosure();

  const handleCancel = () => {
    onClose();
    onCancel();
    showCustomToast({
      title: "Operación cancelada",
      message: "Se han deshecho los cambios",
      iconColor: "var(--warning-color)",
      iconSize: 24,
      icon: CircleX,
    });
  };
  return (
    <>
      <Button onPress={onOpen} variant="solid" color="danger" radius="sm">
        Cancelar
      </Button>

      <Modal
        isDismissable={false}
        hideCloseButton
        inert={!isOpen}
        isOpen={isOpen}
        onClose={onClose}
        size="xl"
        radius="sm"
      >
        <ModalContent>
          <ModalHeader className="flex items-start gap-4">
            <AlertTriangle
              size={24}
              className="text-[var(--danger-color)] mt-1"
            />
            <div className="flex flex-col gap-1 h-full">
              <span className="text-[var(--danger-color)] text-xl">
                Hay cambios sin guardar
              </span>
              <span className="flex text-gray-500 text-base flex-1">
                Se perderá el progreso si sales sin guardar.
              </span>
            </div>
          </ModalHeader>
          <ModalBody>
            <span className="text-gray-500 text-sm">
              Puedes guardar el trámite como borrador si deseas continuar en
              otro momento.
            </span>
          </ModalBody>
          <ModalFooter>
            <Button
              onPress={handleCancel}
              variant="ghost"
              color="danger"
              radius="sm"
            >
              Deshacer cambios
            </Button>
            <Button onPress={onClose} color="primary" radius="sm">
              Continuar creando
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
