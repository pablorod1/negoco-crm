"use client";
import { showCustomToast } from "@/core/components/CustomToast";

import { Button } from "@/core/components/ui/button";
import { AlertTriangle, CircleX } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { useState } from "react";

interface Props {
  onCancel: () => void;
  disabled?: boolean;
}

export default function CancelOperationConfirmationModal({
  onCancel,
  disabled,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const onOpen = () => setIsOpen(true);
  const onClose = () => setIsOpen(false);
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
      <Dialog open={isOpen}>
        <DialogTrigger asChild>
          <Button disabled={disabled} onClick={onOpen} variant="destructive">
            Cancelar
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-start gap-4 w-full">
              <AlertTriangle size={24} className="text-danger mt-1" />
              <div className="flex flex-col gap-1 h-full">
                <DialogTitle className="text-danger text-xl">
                  Hay cambios sin guardar
                </DialogTitle>
                <DialogDescription className="flex text-gray-500 text-base flex-1">
                  Se perderá el progreso si sales sin guardar.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <span className="text-gray-500 text-sm">
            Puedes guardar el trámite como borrador si deseas continuar en otro
            momento.
          </span>
          <DialogFooter>
            <Button onClick={handleCancel} variant="destructive">
              Deshacer cambios
            </Button>
            <Button onClick={onClose}>Continuar creando</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
