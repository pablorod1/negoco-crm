"use client";
import React, { useCallback, useMemo } from "react";
import { ComparativaFile } from "@/comparativas/types/comparativa.types";
import { Button } from "@/core/components/ui/button";
import { Download, FileX, FileIcon, Eye } from "lucide-react";
import { formatDateTime, formatFileSize } from "@/core/utils/format";
import DeleteComparativaFileConfirmationModal from "./DeleteComparativaFileConfirmationModal";
import { showCustomToast } from "@/core/components/CustomToast";
import { downloadFile } from "@/core/firebase/data/downloadFile";
import { CloudAlert } from "lucide-react";
import Image from "next/image";
import FilePreview from "@/core/components/FilePreview/FilePreview";
import { FileData } from "@/types/files";

interface FilesListProps {
  files: ComparativaFile[];
  comparativa_id: string;
  organization_id: string;
  isComercial: boolean;
  onDeleted: () => void;
  isProcessed: boolean;
  userId: string;
}

export const FilesList = ({
  files,
  comparativa_id,
  organization_id,
  isComercial,
  onDeleted,
  isProcessed,
  userId,
}: FilesListProps) => {
  const [previewFile, setPreviewFile] = React.useState<FileData | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);
  const handleDownloadFile = useCallback(
    async (filename: string, download_url: string) => {
      try {
        const { success, errors } = await downloadFile(download_url, filename);

        if (!success) {
          console.error(errors);
          showCustomToast({
            title: "Error al descargar el archivo",
            message: errors,
            iconColor: "var(--danger-color)",
            iconSize: 24,
            icon: CloudAlert,
          });
          return;
        }
      } catch (error) {
        console.error(error);
      }
    },
    []
  );

  const handlePreviewFile = (file: ComparativaFile) => {
    // Convert ComparativaFile to FileData format
    const fileData: FileData = {
      id: file.id,
      filename: file.filename,
      extension: file.extension, // No need to normalize here, detectFileType will handle it
      size: file.size,
      download_url: file.download_url,
      preview_url: file.preview_url || undefined,
      upload_date: file.upload_date,
    };

    setPreviewFile(fileData);
    setIsPreviewOpen(true);
  };

  const handleClosePreview = () => {
    setIsPreviewOpen(false);
    setPreviewFile(null);
  };

  // Memoize the file list to prevent unnecessary re-renders
  const fileElements = useMemo(() => {
    return files.map((file, index) => (
      <div
        key={index}
        className="flex items-center justify-between p-3 border rounded-lg h-full"
      >
        <div className="flex items-center gap-3">
          <div className="bg-muted p-2 rounded">
            {file.preview_url ? (
              <Image
                src={file.preview_url}
                alt={file.filename as string}
                width={50}
                height={50}
              />
            ) : (
              <FileIcon className="h-6 w-6 text-primary" />
            )}
          </div>
          <div>
            <p className="font-medium">{file.filename}</p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{file.extension?.toUpperCase()}</span>
              <span>•</span>
              <span>
                {file.size ? formatFileSize(file.size) : "Desconocido"}
              </span>
              <span>•</span>
              <span>{formatDateTime(file.upload_date)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {file.download_url ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePreviewFile(file)}
                className="text-gray-700 border-gray-300 hover:bg-gray-100"
              >
                <Eye className="h-4 w-4 mr-2" />
                Previsualizar
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() =>
                  handleDownloadFile(file.filename, file.download_url)
                }
              >
                <Download className="h-4 w-4" />
              </Button>
            </>
          ) : null}
          {!isComercial ? (
            <DeleteComparativaFileConfirmationModal
              comparativa_id={comparativa_id}
              file={file}
              organization_id={organization_id}
              onDeleted={onDeleted}
              userId={userId}
            />
          ) : null}
        </div>

        {/* File Preview Modal */}
        {previewFile && (
          <FilePreview
            file={previewFile}
            onClose={handleClosePreview}
            isOpen={isPreviewOpen}
          />
        )}
      </div>
    ));
  }, [
    files,
    handleDownloadFile,
    comparativa_id,
    organization_id,
    isComercial,
    onDeleted,
    isPreviewOpen,
    previewFile,
    userId,
  ]);

  if (files.length === 0) {
    return isProcessed ? (
      <div className="flex flex-col items-center justify-center gap-4 p-4 border rounded-lg h-full">
        <FileX className="size-10 text-muted-foreground" />
        <p className="text-muted-foreground flex items-center gap-2">
          No hay archivos adjuntos.{" "}
        </p>
        <span className="text-sm text-muted-foreground">
          Los archivos de esta comparativa se han movido al trámite asignado.
          Por favor, revisa el trámite para ver los archivos.
        </span>
      </div>
    ) : (
      <p className="text-muted-foreground flex items-center gap-2">
        No hay archivos adjuntos.{" "}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{fileElements}</div>
  );
};
