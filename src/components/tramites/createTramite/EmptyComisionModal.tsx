"use client";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TramiteDB } from "@/lib/core/types";

import { Button } from "@/components/ui/button";
import { DialogDescription, DialogTrigger } from "@radix-ui/react-dialog";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import ButtonGroupComponent from "@/components/core/ButtonGroupComponent";

interface Props {
  tramite: TramiteDB;
  onBack: () => void;
  onCancel: () => void;
}

export default function EmptyComisionModal({
  tramite,
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
          onSubmit={onOpen}
          onBack={onBack}
          onCancel={onCancel}
        />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader className="flex items-start gap-4">
          <AlertTriangle size={36} className="text-danger mt-1" />
          <div className="flex flex-col h-full">
            <DialogTitle className="text-danger text-xl">
              Comisiones sin asignar
            </DialogTitle>
            <DialogDescription className="flex text-gray-500 text-sm flex-1">
              Es necesario asignar comisiones antes de continuar.
            </DialogDescription>
          </div>
        </DialogHeader>
        <div className="space-y-2 ">
          <p className=" text-gray-700 font-bold">
            Comisión: <span className="font-medium">{tramite.comision}</span>
          </p>
          <p className="font-bold text-gray-700">
            Comisión {tramite.sales_name}:{" "}
            <span className="font-medium">{tramite.comision_sales_person}</span>
          </p>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Entendido</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
