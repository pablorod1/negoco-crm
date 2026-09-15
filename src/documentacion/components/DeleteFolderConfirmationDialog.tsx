"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle, CircleX } from "lucide-react";

import { Button } from "@/core/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/core/components/ui/dialog";
import LoadingStateModal from "@/core/components/LoadingStateModal";
import { showCustomToast } from "@/core/components/CustomToast";
import { useDocumentacion } from "@/core/contexts/DocumentacionContext";
import {
  deleteDocumentLibraryFolder,
  describeMutationError,
} from "@/documentacion/lib/document-library-api";
import { describeFolderPath } from "@/documentacion/lib/folder-tree";

interface DeleteFolderConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderPath: string;
  organizationId: string;
}

export function DeleteFolderConfirmationDialog({
  open,
  onOpenChange,
  folderPath,
  organizationId,
}: DeleteFolderConfirmationDialogProps) {
  const { refreshDocumentacion } = useDocumentacion();
  const [deleting, setDeleting] = useState(false);
  const segments = folderPath.split("/");
  const name = segments[segments.length - 1];

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const result = await deleteDocumentLibraryFolder({
        organizationId,
        folderPath,
      });

      if (!result.success) {
        showCustomToast({
          title: "Error eliminando carpeta",
          message: describeMutationError(result, "Inténtalo de nuevo más tarde."),
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: CircleX,
        });
        return;
      }

      showCustomToast({
        title: "Carpeta eliminada",
        message: `La carpeta «${name}» y su contenido se han eliminado.`,
        iconColor: "var(--success-color)",
        iconSize: 24,
        icon: CheckCircle,
      });
      onOpenChange(false);
      refreshDocumentacion();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-0 shadow-xl">
        {deleting && (
          <LoadingStateModal
            title="Eliminando carpeta..."
            description="Espere unos segundos mientras eliminamos la carpeta."
          />
        )}
        <DialogHeader className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <div className="space-y-2">
              <DialogTitle className="text-lg font-semibold text-gray-900">
                Eliminar la carpeta «{name}»
              </DialogTitle>
              <DialogDescription className="text-sm leading-relaxed text-gray-600">
                Se eliminarán permanentemente todos los documentos y subcarpetas
                de {describeFolderPath(folderPath)}. No se puede deshacer.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleting}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            Eliminar carpeta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
