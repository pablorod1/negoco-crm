"use client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TramiteDB } from "@/lib/core/types";

import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import ButtonGroupComponent from "@/components/core/ButtonGroupComponent";

interface Props {
  tramite: TramiteDB;
  onSubmit: () => void;
  onBack: () => void;
  onCancel: () => void;
}

export default function CheckComisionModal({
  tramite,
  onSubmit,
  onBack,
  onCancel,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const onClose = () => {
    setIsOpen(false);
  };

  const onOpen = () => {
    setIsOpen(true);
  };
  return (
    <Dialog open={isOpen}>
      <DialogTrigger asChild>
        <ButtonGroupComponent
          onBack={onBack}
          onCancel={onCancel}
          onSubmit={onOpen}
        />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader className="flex items-start gap-4">
          <AlertTriangle size={36} className="text-danger mt-1" />
          <div className="flex flex-col gap-1 h-full">
            <DialogTitle className="text-danger text-xl">
              Comprobar comisiones
            </DialogTitle>
            <DialogDescription className="flex text-gray-500 text-base flex-1">
              Se recomienda verificar las comisiones antes de continuar.
            </DialogDescription>
          </div>
        </DialogHeader>
        <div className="space-y-2 ">
          <p className=" text-gray-500 font-semibold">
            Comisión: <span className="font-medium">{tramite.comision}</span>
          </p>
          <p className="font-semibold text-gray-500">
            Comisión {tramite.sales_name}:{" "}
            <span className="font-medium">{tramite.comision_sales_person}</span>
          </p>
        </div>
        <DialogFooter>
          <Button variant="destructive" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={onSubmit}>Entendido</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
