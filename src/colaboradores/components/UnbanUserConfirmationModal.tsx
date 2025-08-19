"use client";
import { Button } from "@/core/components/ui/button";
import { showCustomToast } from "@/core/components/CustomToast";
import { authClient } from "@/core/auth/auth-client";
import { AlertTriangle, Ban, Unlock, UserRoundX } from "lucide-react";
import { useUsers } from "@/core/contexts/UsersContext";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/core/components/ui/dialog";
import { useState } from "react";
import TooltipComponent from "@/core/components/TooltipComponent";

interface Props {
  user_id: string;
  userName?: string; // Nombre opcional para personalizar el mensaje
}

export default function UnbanUserConfirmationModal({
  user_id,
  userName,
}: Props) {
  const { refreshUsers } = useUsers();
  const [isOpen, setIsOpen] = useState(false);

  const onOpen = () => setIsOpen(true);
  const onClose = () => setIsOpen(false);
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
      <Dialog open={isOpen}>
        <DialogTrigger asChild>
          <TooltipComponent content="Habilitar usuario">
            <Button size="icon" onClick={onOpen}>
              <Unlock size={16} />
            </Button>
          </TooltipComponent>
        </DialogTrigger>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-primary">
              <AlertTriangle className="text-primary" size={30} />
              <DialogTitle className="text-xl">
                Confirmar activación
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <p className="text-gray-700">
              ¿Estás seguro que deseas volver a habilitar a{" "}
              <strong>{userName}</strong>?
            </p>
            <p className="text-gray-500 text-sm">
              Este usuario podrá iniciar sesión nuevamente.
            </p>
          </div>

          <DialogFooter>
            <Button variant="destructive" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleBan}>
              <Unlock size={16} />
              Habilitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
