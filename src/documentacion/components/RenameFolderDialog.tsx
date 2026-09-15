"use client";

import { useState } from "react";
import { CheckCircle, CircleX } from "lucide-react";

import { Button } from "@/core/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/core/components/ui/dialog";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import LoadingStateModal from "@/core/components/LoadingStateModal";
import { showCustomToast } from "@/core/components/CustomToast";
import { useDocumentacion } from "@/core/contexts/DocumentacionContext";
import { useDocumentLibraryFolderTree } from "@/documentacion/hooks/useDocumentLibraryFolderTree";
import { describeMutationError } from "@/documentacion/lib/document-library-api";
import { moveDocumentLibraryFolder } from "@/documentacion/lib/move-client";
import type { MoveProgress } from "@/documentacion/lib/move-types";
import { describeMoveProgress } from "./MoveToFolderDialog";
import {
  describeFolderPath,
  folderAncestors,
  validateNewFolderName,
} from "@/documentacion/lib/folder-tree";

interface RenameFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderPath: string;
  organizationId: string;
}

function RenameFolderDialogBody({
  folderPath,
  organizationId,
  onClose,
}: Omit<RenameFolderDialogProps, "open" | "onOpenChange"> & {
  onClose: () => void;
}) {
  const { refreshDocumentacion } = useDocumentacion();
  const { tree, loading } = useDocumentLibraryFolderTree();
  const segments = folderPath.split("/");
  const currentName = segments[segments.length - 1];
  const parentPath = folderAncestors(folderPath).pop() ?? "/";
  const [name, setName] = useState(currentName);
  const [renaming, setRenaming] = useState(false);
  const [progress, setProgress] = useState<MoveProgress | null>(null);

  const isUnchanged = name.trim() === currentName;
  const error = isUnchanged
    ? null
    : validateNewFolderName(name, parentPath, tree);
  const canSubmit = !loading && !renaming && !isUnchanged && !error;

  const handleRename = async () => {
    setRenaming(true);
    setProgress(null);
    try {
      const result = await moveDocumentLibraryFolder(
        {
          organizationId,
          folderPath,
          newName: name.trim(),
        },
        setProgress
      );

      if (!result.success) {
        showCustomToast({
          title: "No se pudo renombrar la carpeta",
          message: describeMutationError(result, "Inténtalo de nuevo más tarde."),
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: CircleX,
        });
        return;
      }

      showCustomToast({
        title: "Carpeta renombrada",
        message: `«${currentName}» ahora se llama «${name.trim()}».`,
        iconColor: "var(--success-color)",
        iconSize: 24,
        icon: CheckCircle,
      });
      onClose();
      refreshDocumentacion();
    } finally {
      setRenaming(false);
      setProgress(null);
    }
  };

  return (
    <>
      {renaming && (
        <LoadingStateModal
          title="Renombrando carpeta..."
          description={describeMoveProgress(progress)}
        />
      )}
      <div className="space-y-2">
        <Label htmlFor="rename-folder-name">Nuevo nombre</Label>
        <Input
          id="rename-folder-name"
          autoFocus
          value={name}
          disabled={renaming}
          aria-invalid={Boolean(error)}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && canSubmit) handleRename();
          }}
          className="rounded-md"
        />
        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : (
          <p className="text-sm text-gray-500">
            En {describeFolderPath(parentPath)}
          </p>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={renaming}>
          Cancelar
        </Button>
        <Button onClick={handleRename} disabled={!canSubmit}>
          Renombrar
        </Button>
      </DialogFooter>
    </>
  );
}

export function RenameFolderDialog({
  open,
  onOpenChange,
  folderPath,
  organizationId,
}: RenameFolderDialogProps) {
  const onClose = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-full">
        <DialogHeader>
          <DialogTitle className="text-xl text-primary-800">
            Renombrar carpeta
          </DialogTitle>
          <DialogDescription>
            Los documentos de la carpeta y de sus subcarpetas se mantienen.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <RenameFolderDialogBody
            folderPath={folderPath}
            organizationId={organizationId}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
