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
import { formatComission } from "@/lib/core/format";

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
        <DialogHeader>
          <div className="flex items-start gap-4">
            <AlertTriangle size={24} className="text-danger mt-1" />
            <div className="flex flex-col ">
              <DialogTitle className="text-danger text-xl">
                Comprobar comisiones
              </DialogTitle>
              <DialogDescription className=" text-gray-500 text-sm">
                Se recomienda verificar las comisiones antes de continuar.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="border rounded-md p-2">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-500">
                  Comisión
                </th>

                <th className="px-3 py-2 text-left font-medium text-gray-500">
                  Comision Comercial
                </th>
              </tr>
            </thead>
            <tbody>
              <tr key={tramite.id} className="bg-white">
                <td className="px-3 py-2">
                  {formatComission(tramite.comision)}
                </td>
                <td className="px-3 py-2">
                  {formatComission(tramite.comision_sales_person)}
                </td>
              </tr>
            </tbody>
          </table>
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
