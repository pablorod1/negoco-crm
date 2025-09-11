"use client";
import { Button } from "@/core/components/ui/button";
import { showCustomToast } from "@/core/components/CustomToast";
import { authClient } from "@/core/auth/auth-client";
import { AlertTriangle, Ban, UserRoundX } from "lucide-react";
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
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <TooltipComponent color="bg-danger" content="Desactivar usuario">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
            onClick={() => setIsOpen(true)}
          >
            <Ban size={14} />
          </Button>
        </TooltipComponent>
      </DialogTrigger>
      <DialogContent
        aria-describedby={undefined}
        className="max-w-md border-gray-200"
      >
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
              <AlertTriangle className="text-red-600" size={20} />
            </div>
            <DialogTitle className="text-lg font-semibold text-gray-900">
              Desactivar usuario
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-gray-700">
            ¿Estás seguro que deseas desactivar
            {userName ? ` a ${userName}` : " este usuario"}?
          </p>
          <div className="bg-red-50 p-3 rounded-lg">
            <p className="text-sm text-red-700">
              El usuario no podrá acceder al sistema hasta que sea reactivado.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 border-gray-200 text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleBan}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white"
          >
            <Ban size={16} />
            Desactivar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
