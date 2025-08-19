"use client";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/core/components/ui/dialog";
import { TramiteDB } from "@/tramites/types";

import { Button } from "@/core/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import ButtonGroupComponent from "@/core/components/ButtonGroupComponent";
import { formatComission } from "@/core/utils/format";

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
        <DialogHeader>
          <div className="flex items-start gap-4">
            <AlertTriangle size={20} className="text-danger mt-1" />
            <div className="flex flex-col h-full">
              <DialogTitle className="text-danger text-xl">
                Comisiones sin asignar
              </DialogTitle>
              <DialogDescription className="flex text-gray-500 text-sm flex-1">
                Es necesario asignar comisiones antes de continuar.
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
          <Button onClick={onClose}>Entendido</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
