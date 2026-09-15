"use client";

import { useState } from "react";
import { FolderInput } from "lucide-react";

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
import { normalizeDocumentLibraryFolderPath } from "@/core/utils/document-library-path";
import { useDocumentLibraryFolderTree } from "@/documentacion/hooks/useDocumentLibraryFolderTree";
import {
  describeFolderPath,
  FolderNode,
} from "@/documentacion/lib/folder-tree";
import type { MoveProgress } from "@/documentacion/lib/move-types";
import { FolderPicker } from "./FolderPicker";

interface MoveToFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /**
   * Carpeta en la que está ahora lo que se mueve: no es un destino válido.
   * Sin ella (ficheros de varias carpetas) cualquier destino vale.
   */
  currentFolder?: string;
  /** Destinos no elegibles (p. ej. la propia carpeta que se mueve y sus hijas). */
  isDisabled?: (node: FolderNode) => boolean;
  /** Devuelve `true` si se ha movido; el diálogo se cierra entonces. */
  onMove: (
    destinationFolder: string,
    onProgress: (progress: MoveProgress) => void
  ) => Promise<boolean>;
}

/** "Copiando 3 de 40: tarifa.pdf" mientras el navegador mueve los objetos. */
export function describeMoveProgress(progress: MoveProgress | null): string {
  if (!progress || progress.total === 0) {
    return "Preparando el movimiento…";
  }
  if (progress.done >= progress.total) {
    return "Confirmando…";
  }
  const base = `Copiando ${progress.done + 1} de ${progress.total}`;
  return progress.current ? `${base}: ${progress.current}` : base;
}

function MoveToFolderDialogBody({
  currentFolder,
  isDisabled,
  onMove,
  onClose,
}: Pick<MoveToFolderDialogProps, "currentFolder" | "isDisabled" | "onMove"> & {
  onClose: () => void;
}) {
  const { tree, loading } = useDocumentLibraryFolderTree();
  const [destination, setDestination] = useState(
    normalizeDocumentLibraryFolderPath(currentFolder)
  );
  const [moving, setMoving] = useState(false);
  const [progress, setProgress] = useState<MoveProgress | null>(null);

  const isSameFolder =
    currentFolder !== undefined &&
    destination === normalizeDocumentLibraryFolderPath(currentFolder);

  const handleMove = async () => {
    setMoving(true);
    setProgress(null);
    try {
      if (await onMove(destination, setProgress)) onClose();
    } finally {
      setMoving(false);
      setProgress(null);
    }
  };

  return (
    <>
      {moving && (
        <LoadingStateModal
          title="Moviendo..."
          description={describeMoveProgress(progress)}
        />
      )}
      <FolderPicker
        tree={tree}
        value={destination}
        onChange={setDestination}
        disabled={loading || moving}
        isDisabled={isDisabled}
      />
      <p className="text-sm text-gray-600">
        {isSameFolder ? (
          <span className="text-gray-500">Ya está en esta carpeta.</span>
        ) : (
          <>
            Se moverá a{" "}
            <span className="font-medium text-gray-900">
              {describeFolderPath(destination)}
            </span>
          </>
        )}
      </p>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={moving}>
          Cancelar
        </Button>
        <Button
          onClick={handleMove}
          disabled={loading || moving || isSameFolder}
        >
          <FolderInput className="h-4 w-4" />
          Mover aquí
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * Elegir la carpeta destino de uno o varios ficheros, o de una carpeta.
 * El árbol se carga al abrir, no antes: hay un diálogo por tarjeta.
 */
export function MoveToFolderDialog({
  open,
  onOpenChange,
  title,
  description,
  currentFolder,
  isDisabled,
  onMove,
}: MoveToFolderDialogProps) {
  const onClose = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl w-full">
        <DialogHeader>
          <DialogTitle className="text-xl text-primary-800">{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : (
            <DialogDescription className="sr-only">
              Elige la carpeta destino
            </DialogDescription>
          )}
        </DialogHeader>
        {open && (
          <MoveToFolderDialogBody
            currentFolder={currentFolder}
            isDisabled={isDisabled}
            onMove={onMove}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
