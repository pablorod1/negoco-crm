import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure,
} from "@heroui/modal";
import { Tooltip } from "@heroui/tooltip";
import { Button } from "@heroui/button";
import { showCustomToast } from "../core/CustomToast";
import { authClient } from "@/lib/auth/auth-client";
import { AlertTriangle, Ban, UserRoundX } from "lucide-react";
import { useUsers } from "@/lib/contexts/UsersContext";

interface Props {
  user_id: string;
  userName?: string; // Nombre opcional para personalizar el mensaje
}

export default function BanUserConfirmationModal({ user_id, userName }: Props) {
  const { refreshUsers } = useUsers();
  const { onOpen, onClose, isOpen } = useDisclosure();

  const handleBan = async () => {
    try {
      const response = await authClient.admin.banUser({
        userId: user_id,
      });

      if (response.error) {
        showCustomToast({
          title: "Error",
          message: response.error.message as string,
          icon: Ban,
          iconSize: 24,
          iconColor: "red",
        });
        console.error(response.error);
        return;
      }

      showCustomToast({
        title: "Usuario eliminado",
        message: "El usuario ha sido eliminado correctamente",
        icon: UserRoundX,
        iconSize: 24,
        iconColor: "green",
      });

      // Cerrar el modal después de eliminar con éxito
      onClose();

      // Después de eliminar con éxito, actualizamos la lista de usuarios
      refreshUsers();
    } catch (error) {
      showCustomToast({
        title: "Error",
        message: "Error desconocido al eliminar el usuario",
        icon: Ban,
        iconSize: 24,
        iconColor: "red",
      });
      console.error(error);
    }
  };

  return (
    <>
      <Button
        variant="light"
        isIconOnly
        color="danger"
        size="sm"
        onPress={onOpen}
        className="opacity-70 hover:opacity-100 hover:bg-red-50 transition-all"
      >
        <Tooltip color="danger" content="Deshabilitar usuario" radius="full">
          <Ban size={16} />
        </Tooltip>
      </Button>
      <Modal isOpen={isOpen} onClose={onClose} size="xl">
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-danger">
              <AlertTriangle className="text-danger" size={30} />
              <h2 className="text-xl">Confirmar desactivación</h2>
            </div>
          </ModalHeader>

          <ModalBody>
            <div className="flex flex-col">
              <p className="text-gray-700">
                ¿Estás seguro que deseas deshabilitar
                {userName ? ` a ${userName}` : " este usuario"}?
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Para deshacer esta acción, deberás contactar al equipo de
                soporte.
              </p>
            </div>
          </ModalBody>

          <ModalFooter>
            <Button variant="light" onPress={onClose} className="mr-2">
              Cancelar
            </Button>
            <Button
              color="danger"
              onPress={handleBan}
              startContent={<Ban size={16} />}
            >
              Deshabilitar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
