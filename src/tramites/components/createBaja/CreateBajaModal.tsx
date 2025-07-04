"use client";
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/core/components/ui/dialog";
import { Button } from "@/core/components/ui/button";
import { CircleX, PlusCircle } from "lucide-react";
import CreateBajaForm from "./CreateBajaForm";
import { useTramites } from "@/core/contexts/TramitesContext";
import { showCustomToast } from "@/core/components/CustomToast";

export default function CreateBajaModal() {
  const [isOpen, setIsOpen] = React.useState(false);
  const { refreshTramites } = useTramites();

  const onClose = () => setIsOpen(false);
  const onOpen = () => setIsOpen(true);

  const handleFinish = async () => {
    try {
      await refreshTramites();
      onClose();
    } catch (error) {
      console.error("Error refreshing tramites:", error);
      showCustomToast({
        title: "Error",
        message: "No se pudo refrescar la lista de tramites.",
        icon: CircleX,
        iconSize: 24,
        iconColor: "var(--danger-color)",
      });
      onClose();
    }
  };

  return (
    <>
      <Dialog open={isOpen}>
        <DialogTrigger asChild>
          <Button
            onClick={onOpen}
            variant="destructiveOutline"
            className="w-full"
          >
            <PlusCircle size={16} />
            Nueva Baja
          </Button>
        </DialogTrigger>
        <DialogContent className="w-full max-w-2xl">
          <DialogHeader
            className="text-2xl text-danger font-bold"
            aria-describedby={undefined}
          >
            <DialogTitle>Nueva Baja</DialogTitle>
          </DialogHeader>
          <CreateBajaForm onCancel={onClose} onFinish={handleFinish} />
        </DialogContent>
      </Dialog>
    </>
  );
}

