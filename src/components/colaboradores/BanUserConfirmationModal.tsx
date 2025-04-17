"use client";
import { Button } from "@/components/ui/button";
import { showCustomToast } from "../core/CustomToast";
import { authClient } from "@/lib/auth/auth-client";
import { AlertTriangle, Ban, UserRoundX } from "lucide-react";
import { useUsers } from "@/lib/contexts/UsersContext";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { useState } from "react";
import TooltipComponent from "../core/TooltipComponent";

interface Props {
  user_id: string;
  userName?: string; // Nombre opcional para personalizar el mensaje
}

export default function BanUserConfirmationModal({ user_id, userName }: Props) {
  const { refreshUsers } = useUsers();
  const [isOpen, setIsOpen] = useState(false);

  const onClose = () => {
    setIsOpen(false);
  };

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
      <Dialog open={isOpen}>
        <DialogTrigger asChild>
          <TooltipComponent color="bg-danger" content="Deshabilitar usuario">
            <Button
              variant="destructive"
              color="danger"
              size="icon"
              onClick={() => setIsOpen(true)}
              className="opacity-70 hover:opacity-100 hover:bg-red-50 transition-all"
            >
              <Ban size={16} />
            </Button>
          </TooltipComponent>
        </DialogTrigger>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-danger">
              <AlertTriangle className="text-danger" size={30} />
              <DialogTitle className="text-xl">
                Confirmar desactivación
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="flex flex-col">
            <p className="text-gray-700">
              ¿Estás seguro que deseas deshabilitar
              {userName ? ` a ${userName}` : " este usuario"}?
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Para deshacer esta acción, deberás contactar al equipo de soporte.
            </p>
          </div>

          <DialogFooter>
            <Button variant="destructive" onClick={onClose} className="mr-2">
              Cancelar
            </Button>
            <Button color="danger" onClick={handleBan}>
              <Ban size={16} />
              Deshabilitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
