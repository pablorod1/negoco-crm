import { showCustomToast } from "@/components/core/CustomToast";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure,
} from "@heroui/modal";
import { Button } from "@heroui/react";
import { AlertTriangle, PencilOff } from "lucide-react";

interface Props {
  onCancel: () => void;
}

export default function CancelEditTramiteConfirmationModal({
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
      icon: PencilOff,
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
            <div className="flex flex-col gap-1">
              <span className="text-[var(--danger-color)] text-xl ">
                Hay cambios sin guardar
              </span>
              <span className="text-gray-500 text-sm">
                ¿Estás seguro que deseas salir sin guardar los cambios?
              </span>
            </div>
          </ModalHeader>
          <ModalBody className="px-0"></ModalBody>
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
              Continuar editando
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
