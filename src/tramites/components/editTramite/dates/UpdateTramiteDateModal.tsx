import ButtonGroupComponent from "@/core/components/ButtonGroupComponent";
import { showCustomToast } from "@/core/components/CustomToast";
import { DatePicker } from "@/core/components/DatePicker";
import { Button } from "@/core/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/core/components/ui/dialog";
import { Label } from "@/core/components/ui/label";
import { CircleCheck, CircleX, Pencil } from "lucide-react";
import { useState } from "react";

interface Props {
  dateToChange: string;
  fieldToChange?: string;
  date: Date;
  tramite_id: string;
  onUpdate?: () => void;
}

export default function UpdateTramiteDateModal({
  dateToChange,
  date,
  tramite_id,
  fieldToChange,
  onUpdate,
}: Props) {
  const [newDate, setNewDate] = useState<Date | null>(date);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const onOpen = () => setIsOpen(true);
  const onClose = () => setIsOpen(false);

  const checkChanges = () => {
    if (!newDate) return false;
    const currentDate = new Date(date);
    return (
      newDate.getFullYear() !== currentDate.getFullYear() ||
      newDate.getMonth() !== currentDate.getMonth() ||
      newDate.getDate() !== currentDate.getDate()
    );
  };

  const handleSubmit = async () => {
    if (!checkChanges()) {
      showCustomToast({
        title: "Error",
        message: "No se han realizado cambios en la fecha",
        icon: CircleX,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
      onClose();
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/v2/contracts/${tramite_id}/dates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          field: fieldToChange,
          date: newDate,
        }),
      });

      const { success, error } = await response.json();

      if (!success) {
        showCustomToast({
          title: "Error",
          message: error || "Error al actualizar la fecha",
          icon: CircleX,
          iconColor: "var(--danger-color)",
          iconSize: 24,
        });
        return;
      }

      showCustomToast({
        title: "Trámite actualizado",
        message: `${dateToChange} actualizada correctamente`,
        icon: CircleCheck,
        iconColor: "var(--success-color)",
        iconSize: 24,
      });
      onClose();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error("Error al actualizar la fecha del trámite :", error);
      showCustomToast({
        title: "Error",
        message: "Error al actualizar la fecha del trámite",
        icon: CircleX,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          size="icon"
          variant="primaryGhost"
          className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          onClick={onOpen}
        >
          <Pencil className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-primary">
            Actualizar {dateToChange}
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-400">
            Aquí puedes actualizar la fecha de {dateToChange}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1 w-full">
          <Label htmlFor="activation_date">{dateToChange}</Label>
          <DatePicker
            date={newDate as Date}
            setDate={(value) => setNewDate(value as Date)}
          />
        </div>
        <DialogFooter>
          <ButtonGroupComponent
            onCancel={onClose}
            onSubmit={handleSubmit}
            lastStep
            loading={loading}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
