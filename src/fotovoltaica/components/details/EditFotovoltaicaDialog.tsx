import { Button } from "@/core/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/core/components/ui/sheet";
import { User } from "@/core/types";
import { PencilLine } from "lucide-react";
import { useState } from "react";
import EditFotovoltaicaClientForm from "./clientDetails/EditFotovoltaicaClientForm";
import EditFotovoltaicaComisionsForm from "./comisionDetails/EditFotovoltaicaComisionsForm";
import { FotovoltaicaVM } from "@/fotovoltaica/types";

interface Props {
  type: "client" | "comision";
  fotovoltaica: FotovoltaicaVM;
  onSubmit: () => void;
  userData: User;
}

export default function EditFotovoltaicaDialog({
  type,
  fotovoltaica,
  onSubmit,
  userData,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpen = () => setIsOpen(true);
  const handleClose = () => setIsOpen(false);
  const handleSubmit = () => {
    onSubmit();
    handleClose();
  };

  const getTitle = () => {
    switch (type) {
      case "client":
        return "Datos del Cliente";
      case "comision":
        return "Información Financiera";
      default:
        return "Editar Fotovoltaica";
    }
  };
  return (
    <Sheet open={isOpen} onOpenChange={handleOpen}>
      <SheetTrigger asChild>
        <Button variant={"ghost"} size={"icon"}>
          <PencilLine className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent
        aria-describedby={undefined}
        className="w-[35vw]"
        side="right"
      >
        <SheetHeader className="mb-8">
          <SheetTitle className="text-xl font-semibold text-primary-800">
            {getTitle()}
          </SheetTitle>
        </SheetHeader>
        {type === "client" ? (
          <EditFotovoltaicaClientForm
            fotovoltaica={fotovoltaica}
            onSubmit={handleSubmit}
            onCancel={handleClose}
            userData={userData}
          />
        ) : type === "comision" ? (
          <EditFotovoltaicaComisionsForm
            fotovoltaica={fotovoltaica}
            onSubmit={handleSubmit}
            onCancel={handleClose}
            userData={userData}
          />
        ) : (
          <div>Tipo de edición no soportado</div>
        )}
      </SheetContent>
    </Sheet>
  );
}
