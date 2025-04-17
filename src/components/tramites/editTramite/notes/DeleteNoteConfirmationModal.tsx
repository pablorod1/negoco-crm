"use client";
import {
  Dialog,
  DialogHeader,
  DialogContent,
  DialogFooter,
  DialogTrigger,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, CircleX, Trash } from "lucide-react";
import { showCustomToast } from "@/components/core/CustomToast";
import { memo, useState } from "react";

interface DeleteNoteConfirmationModalProps {
  note: string;
  notes: string[];
  tramite_id: string;
  onDeleted: () => void;
}

const DeleteTramiteNoteConfirmationModal = memo(
  ({
    note,
    notes,
    tramite_id,
    onDeleted,
  }: DeleteNoteConfirmationModalProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const onOpen = () => setIsOpen(true);
    const onClose = () => setIsOpen(false);
    const handleDelete = async () => {
      try {
        const rs = await fetch(`/api/tramites/delete/note`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ note, id: tramite_id, notes }),
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
            <Button size="icon" variant="destructive" onClick={onOpen}>
              <Trash size={16} />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <div className="flex items-start gap-4">
                <AlertTriangle className="size-12 text-danger" />
                <div className="flex flex-col">
                  <DialogTitle className="text-lg font-semibold text-danger">
                    ¿Estás seguro de que deseas eliminar la nota?
                  </DialogTitle>
                  <DialogDescription className="text-gray-600 text-sm">
                    Se eliminará de forma permanente.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <div className="px-4 py-2 rounded-md border border-gray flex justify-between">
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

DeleteTramiteNoteConfirmationModal.displayName =
  "DeleteTramiteNoteConfirmationModal";

export default DeleteTramiteNoteConfirmationModal;
