"use client";

import { CheckCircle, CircleX } from "lucide-react";

import { showCustomToast } from "@/core/components/CustomToast";
import { useDocumentacion } from "@/core/contexts/DocumentacionContext";
import { DocumentacionFile, User } from "@/core/types";
import { normalizeDocumentLibraryFolderPath } from "@/core/utils/document-library-path";
import { describeMutationError } from "@/documentacion/lib/document-library-api";
import { moveDocumentLibraryFiles } from "@/documentacion/lib/move-client";
import type { MoveProgress } from "@/documentacion/lib/move-types";
import { MoveToFolderDialog } from "./MoveToFolderDialog";

interface MoveFilesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: DocumentacionFile[];
  userData: User;
  /** Tras mover con éxito (p. ej. para vaciar la selección). */
  onMoved?: () => void;
}

/** «Mover a…» de uno o varios ficheros: diálogo + llamada + avisos. */
export function MoveFilesDialog({
  open,
  onOpenChange,
  files,
  userData,
  onMoved,
}: MoveFilesDialogProps) {
  const { refreshDocumentacion } = useDocumentacion();
  const folders = new Set(
    files.map((file) => normalizeDocumentLibraryFolderPath(file.folder_name))
  );
  // Con ficheros de varias carpetas no hay "carpeta actual" que excluir
  const currentFolder =
    folders.size === 1 ? Array.from(folders)[0] : undefined;
  const count = files.length;

  const handleMove = async (
    destinationFolder: string,
    onProgress: (progress: MoveProgress) => void
  ) => {
    const result = await moveDocumentLibraryFiles(
      {
        organizationId: userData.organization.id,
        fileIds: files.map((file) => file.id),
        destinationFolder,
      },
      onProgress
    );

    if (!result.success) {
      showCustomToast({
        title:
          count > 1 ? "No se pudieron mover los archivos" : "No se pudo mover el archivo",
        message: describeMutationError(result, "Inténtalo de nuevo más tarde."),
        iconColor: "var(--danger-color)",
        iconSize: 24,
        icon: CircleX,
      });
      return false;
    }

    showCustomToast({
      title: count > 1 ? "Archivos movidos" : "Archivo movido",
      message:
        count > 1
          ? `Se han movido ${count} archivos correctamente.`
          : `«${files[0]?.name}» se ha movido correctamente.`,
      iconColor: "var(--success-color)",
      iconSize: 24,
      icon: CheckCircle,
    });
    onMoved?.();
    refreshDocumentacion();
    return true;
  };

  return (
    <MoveToFolderDialog
      open={open}
      onOpenChange={onOpenChange}
      title={count > 1 ? `Mover ${count} archivos` : `Mover «${files[0]?.name}»`}
      currentFolder={currentFolder}
      onMove={handleMove}
    />
  );
}
