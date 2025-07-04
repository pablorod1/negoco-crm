"use client";
import {
  Dialog,
  DialogHeader,
  DialogContent,
  DialogFooter,
  DialogTrigger,
  DialogTitle,
  DialogDescription,
} from "@/core/components/ui/dialog";
import { Button } from "@/core/components/ui/button";
import { AlertTriangle, CheckCircle, CloudAlert, Trash } from "lucide-react";
import { showCustomToast } from "@/core/components/CustomToast";
import { memo, useState } from "react";
import { formatFileSize } from "@/core/utils/format";
import { TramiteFile } from "@/tramites/types";

interface DeleteFileConfirmationModalProps {
  tramite_id: string;
  organization_id: string;
  file: TramiteFile;
  onDeleted: () => void;
}

const DeleteTramiteFileConfirmationModal = memo(
  ({
    tramite_id,
    organization_id,
    file,
    onDeleted,
  }: DeleteFileConfirmationModalProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const onOpen = () => setIsOpen(true);
    const onClose = () => setIsOpen(false);
    const handleDeleteFile = async () => {
      try {
        const res = await fetch(`/api/tramites/delete/${tramite_id}/file`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            file_name: file.filename,
            organization_id,
          }),
        });

        const { success, error } = await res.json();

        if (!success) {
          console.error(error);
          showCustomToast({
            title: "Error al eliminar el archivo",
            message: error,
            iconColor: "var(--danger-color)",
            iconSize: 24,
            icon: CloudAlert,
          });
          return;
        }

        showCustomToast({
          title: "Archivo eliminado",
          message: `El archivo ${file.filename} ha sido eliminado.`,
          iconColor: "var(--success-color)",
          iconSize: 24,
          icon: CheckCircle,
        });
        onDeleted();
        onClose();
      } catch (error) {
        console.error(error);
        showCustomToast({
          title: "Error al eliminar el archivo",
          message: "Ocurrió un error al eliminar el archivo.",
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: CloudAlert,
        });
      }
    };

    return (
      <>
        <Dialog open={isOpen}>
          <DialogTrigger asChild>
            <Button size="icon" variant="destructive" onClick={onOpen}>
              <Trash size={20} />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <div className="flex items-start gap-4">
                <AlertTriangle className="size-8 text-danger" />
                <div className="flex flex-col">
                  <DialogTitle className="text-lg font-semibold text-danger">
                    ¿Estás seguro de que deseas eliminar el archivo?
                  </DialogTitle>
                  <DialogDescription className="text-gray-600 text-sm">
                    Se eliminará de forma permanente.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <div className="px-4 py-2 rounded-md border border-gray flex justify-between">
              <span>{file.filename}</span>

              <span>{formatFileSize(file.size)}</span>
            </div>
            <DialogFooter>
              <Button onClick={onClose}>Cancelar</Button>
              <Button variant="destructive" onClick={handleDeleteFile}>
                Eliminar Archivo
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }
);

DeleteTramiteFileConfirmationModal.displayName =
  "DeleteTramiteFileConfirmationModal";
export default DeleteTramiteFileConfirmationModal;
