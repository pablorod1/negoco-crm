import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Tooltip,
  useDisclosure,
} from "@heroui/react";
import { showCustomToast } from "../core/CustomToast";
import { authClient } from "@/lib/auth/auth-client";
import { AlertTriangle, Ban, Unlock, UserRoundX } from "lucide-react";
import { useUsers } from "@/contexts/UsersContext";

interface Props {
  user_id: string;
  userName?: string; // Nombre opcional para personalizar el mensaje
}

export default function UnbanUserConfirmationModal({
  user_id,
  userName,
}: Props) {
  const { refreshUsers } = useUsers();
  const { onOpen, onClose, isOpen } = useDisclosure();

  const handleBan = async () => {
    try {
      const response = await authClient.admin.unbanUser({
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
        title: "Usuario activado",
        message: "El usuario ha sido activado correctamente",
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
        message: "Error desconocido al activar el usuario",
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
        color="primary"
        size="sm"
        onPress={onOpen}
        className="opacity-70 hover:opacity-100 hover:bg-red-50 transition-all"
      >
        <Tooltip color="primary" content="Habilitar usuario" radius="full">
          <Unlock size={16} />
        </Tooltip>
      </Button>
      <Modal isOpen={isOpen} onClose={onClose} size="xl">
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-primary">
              <AlertTriangle className="text-primary" size={30} />
              <h2 className="text-xl">Confirmar activación</h2>
            </div>
          </ModalHeader>

          <ModalBody>
            <div className="flex flex-col">
              <p className="text-gray-700">
                ¿Estás seguro que deseas volver a habilitar
                {userName ? ` a ${userName}` : " este usuario"}?
              </p>
              <p className="text-gray-700">
                Este usuario podrá iniciar sesión nuevamente.
              </p>
            </div>
          </ModalBody>

          <ModalFooter>
            <Button variant="light" onPress={onClose} className="mr-2">
              Cancelar
            </Button>
            <Button
              color="primary"
              onPress={handleBan}
              startContent={<Unlock size={16} />}
            >
              Habilitar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
