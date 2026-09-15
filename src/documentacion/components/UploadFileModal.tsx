"use client";
import { Button } from "@/core/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/core/components/ui/dialog";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { CircleX, FolderPlus, UploadIcon, X } from "lucide-react";
import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { useDocumentacion } from "@/core/contexts/DocumentacionContext";
import { useUser } from "@/core/contexts/UserContext";
import LoadingStateModal from "@/core/components/LoadingStateModal";
import { showCustomToast } from "@/core/components/CustomToast";
import { uploadDocumentLibraryFiles } from "@/documentacion/lib/uploadDocumentLibraryFiles";
import {
  DOCUMENT_LIBRARY_ROOT_FOLDER,
  normalizeDocumentLibraryFolderPath,
} from "@/core/utils/document-library-path";
import { useDocumentLibraryFolderTree } from "@/documentacion/hooks/useDocumentLibraryFolderTree";
import {
  describeFolderPath,
  validateNewFolderName,
} from "@/documentacion/lib/folder-tree";
import { FolderPicker } from "./FolderPicker";

interface FileWithPreview extends File {
  preview?: string;
}

interface UploadFileModalProps {
  initialFolderPath?: string;
}

export default function UploadFileModal({
  initialFolderPath = DOCUMENT_LIBRARY_ROOT_FOLDER,
}: UploadFileModalProps) {
  const normalizedInitialFolderPath =
    normalizeDocumentLibraryFolderPath(initialFolderPath);
  const [isOpen, setIsOpen] = useState(false);
  const { userData } = useUser();
  const { refreshDocumentacion } = useDocumentacion();
  const { tree } = useDocumentLibraryFolderTree();
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string>(
    normalizedInitialFolderPath
  );
  const [createFolder, setCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const onOpen = () => setIsOpen(true);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const filesWithPreview = acceptedFiles.map((file) =>
      Object.assign(file, {
        preview: URL.createObjectURL(file),
      })
    );
    setFiles((prev) => [...prev, ...filesWithPreview]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
  });

  useEffect(() => {
    if (!isOpen) {
      setSelectedFolder(normalizedInitialFolderPath);
    }
  }, [isOpen, normalizedInitialFolderPath]);

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const newFiles = [...prev];
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview!);
      }
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const newFolderError = createFolder
    ? validateNewFolderName(newFolderName, selectedFolder, tree)
    : null;
  // Sólo se avisa cuando el usuario ya ha escrito algo
  const showNewFolderError = createFolder && newFolderName.length > 0;
  const uploadFolderPath = createFolder
    ? normalizeDocumentLibraryFolderPath(
        `${selectedFolder}/${newFolderName.trim()}`
      )
    : selectedFolder;
  const canUpload =
    files.length > 0 && !isUploading && (!createFolder || !newFolderError);

  const handleUpload = async () => {
    try {
      setIsUploading(true);
      await uploadDocumentLibraryFiles({
        files,
        folderName: uploadFolderPath,
        organizationId: userData?.organization.id as string,
      });
      setFiles([]);
      handleClose();
      refreshDocumentacion();
    } catch (error) {
      console.error("Error uploading files:", error);
      showCustomToast({
        title: "Error al subir archivos",
        message:
          error instanceof Error
            ? error.message
            : "Inténtalo de nuevo más tarde.",
        icon: CircleX,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setFiles([]);
    setCreateFolder(false);
    setNewFolderName("");
    setSelectedFolder(normalizedInitialFolderPath);
    setIsOpen(false);
  };

  const cancelNewFolder = () => {
    setCreateFolder(false);
    setNewFolderName("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogTrigger asChild>
        <Button variant="outline" onClick={onOpen}>
          <UploadIcon width={16} height={16} />
          Subir archivos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl w-full">
        <DialogHeader
          className="flex flex-col gap-1"
          aria-describedby={undefined}
        >
          <DialogTitle className="text-xl text-primary-800">
            Subir archivos
          </DialogTitle>
        </DialogHeader>
        {isUploading && (
          <LoadingStateModal
            title="Subiendo archivos..."
            description="Espere unos segundos mientras subimos los archivos."
          />
        )}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                    ${
                      isDragActive
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-300 hover:border-gray-400"
                    }`}
        >
          <input {...getInputProps()} />
          {isDragActive ? (
            <p>Suelta los archivos aquí...</p>
          ) : (
            <div>
              <p>Arrastra y suelta archivos aquí, o haz clic para seleccionar</p>
              <p className="text-sm text-gray-500 mt-2">
                Formatos soportados: PNG, JPG, PDF, DOC, DOCX
              </p>
            </div>
          )}
        </div>
        {files.length > 0 && (
          <ul className="max-h-[130px] space-y-2 overflow-y-auto">
            {files.map((file, index) => (
              <li
                key={`${file.name}-${index}`}
                className="flex items-center justify-between rounded bg-gray-50 p-2"
              >
                <div className="flex min-w-0 items-center space-x-2">
                  <span className="truncate text-sm">{file.name}</span>
                  <span className="shrink-0 text-xs text-gray-500">
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-gray-500 hover:text-red-600"
                  aria-label={`Quitar ${file.name}`}
                  onClick={() => removeFile(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-2">
          <Label className="text-sm font-medium">Carpeta destino</Label>
          <FolderPicker
            tree={tree}
            value={selectedFolder}
            onChange={setSelectedFolder}
            disabled={isUploading}
          />

          {createFolder ? (
            <div className="space-y-2 rounded-lg border border-primary-100 bg-primary-50/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="new-folder-name" className="text-sm">
                  Nueva carpeta en{" "}
                  <span className="font-semibold">
                    {describeFolderPath(selectedFolder)}
                  </span>
                </Label>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-gray-500"
                  aria-label="Cancelar nueva carpeta"
                  onClick={cancelNewFolder}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <Input
                id="new-folder-name"
                type="text"
                autoFocus
                value={newFolderName}
                disabled={isUploading}
                placeholder="Nombre de la carpeta"
                aria-invalid={showNewFolderError && Boolean(newFolderError)}
                onChange={(event) => setNewFolderName(event.target.value)}
                className="rounded-md bg-white"
              />
              {showNewFolderError && newFolderError && (
                <p className="text-sm text-red-600">{newFolderError}</p>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 text-sm">
              <p className="min-w-0 truncate text-gray-600">
                Se subirá en{" "}
                <span className="font-medium text-gray-900">
                  {describeFolderPath(selectedFolder)}
                </span>
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 text-primary-700"
                disabled={isUploading}
                onClick={() => setCreateFolder(true)}
              >
                <FolderPlus className="h-4 w-4" />
                Nueva carpeta
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button color="danger" variant="destructive" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleUpload} disabled={!canUpload}>
            {isUploading ? "Subiendo..." : "Subir archivos"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
