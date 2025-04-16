"use client";
import {
  Dialog,
  DialogHeader,
  DialogContent,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, CircleX, Trash } from "lucide-react";
import { showCustomToast } from "@/components/core/CustomToast";
import { memo, useState } from "react";

interface DeleteNoteConfirmationModalProps {
  note: string;
  notes: string[];
  comparativa_id: string;
  onDeleted: () => void;
}

const DeleteNoteConfirmationModal = memo(
  ({
    note,
    notes,
    comparativa_id,
    onDeleted,
  }: DeleteNoteConfirmationModalProps) => {
    const [isOpen, setIsOpen] = useState(false);

    const onOpen = () => {
      setIsOpen(true);
    };

    const onClose = () => {
      setIsOpen(false);
    };
    const handleDelete = async () => {
      try {
        const rs = await fetch(`/api/comparativas/delete/note`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ note, id: comparativa_id, notes }),
        });

        const { success, error } = await rs.json();

        if (!success) {
          showCustomToast({
            title: "Error",
            message: error,
            icon: CircleX,
            iconSize: 24,
            iconColor: "var(--danger-color)",
          });
          return;
        }

        showCustomToast({
          title: "Nota eliminada",
          message: `La nota ha sido eliminada correctamente`,
          icon: CheckCircle,
          iconSize: 24,
          iconColor: "var(--success-color)",
        });
      } catch (error) {
        console.error("Error al eliminar la nota:", error);
        showCustomToast({
          title: "Error",
          message: "Error al eliminar la nota",
          icon: CircleX,
          iconSize: 24,
          iconColor: "var(--danger-color)",
        });
      } finally {
        onDeleted();
        onClose();
      }
    };

    return (
      <>
        <Dialog open={isOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive" size="icon" onClick={onOpen}>
              <Trash size={16} />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <div className="flex items-start gap-4">
                <AlertTriangle size={32} className="text-danger" />
                <div className="flex flex-col">
                  <h2 className="text-lg font-semibold text-danger">
                    ¿Estás seguro de que deseas eliminar la nota?
                  </h2>
                  <p className="text-gray-600 text-sm">
                    Se eliminará de forma permanente.
                  </p>
                </div>
              </div>
            </DialogHeader>
            <div className="px-4 py-2 border border-gray-300 rounded-md">
              <span>{note}</span>
            </div>
            <DialogFooter>
              <Button onClick={onClose}>Cancelar</Button>
              <Button variant="destructive" onClick={handleDelete}>
                Eliminar nota
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }
);

DeleteNoteConfirmationModal.displayName = "DeleteNoteConfirmationModal";

export default DeleteNoteConfirmationModal;
