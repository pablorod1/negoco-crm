import { showCustomToast } from "@/core/components/CustomToast";
import { Button } from "@/core/components/ui/button";
import { formatDate, formatFileSize } from "@/core/utils/format";
import { TramiteFile } from "@/tramites/types";
import { downloadFile } from "@/core/firebase/data/downloadFile";
import { CloudAlert, Download, Eye, FileIcon } from "lucide-react";
import Image from "next/image";
import DeleteTramiteFileConfirmationModal from "./DeleteTramiteFileConfirmationModal";
import FilePreview from "@/core/components/FilePreview/FilePreview";
import { FileData } from "@/types/files";
import { useState } from "react";

interface Props {
  files: TramiteFile[];
  tramite_id: string;
  organization_id: string;
  onDeleted: () => void;
  isEditable: boolean;
}

export default function TramiteFilesList({
  files,
  tramite_id,
  organization_id,
  onDeleted,
  isEditable,
}: Props) {
  const [previewFile, setPreviewFile] = useState<FileData | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const handleDownloadFile = async (filename: string, download_url: string) => {
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
  };

  const handlePreviewFile = (file: TramiteFile) => {
    // Convert TramiteFile to FileData format
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

  return (
    <div className="space-y-4">
      {files.map((file) => (
        <div
          key={file.id}
          className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <div className="bg-gray-100 p-2 rounded-lg border border-gray-200">
              {file.preview_url ? (
                <Image
                  src={file.preview_url}
                  alt={file.filename as string}
                  width={32}
                  height={32}
                  className="rounded"
                />
              ) : (
                <FileIcon className="h-5 w-5 text-gray-600" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">
                {file.filename}
              </p>
              <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                <span>{file.extension.toUpperCase()}</span>
                <span>•</span>
                <span>{formatFileSize(file.size)}</span>
                <span>•</span>
                <span>{formatDate(file.upload_date)}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {file.download_url && (
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
                  size="sm"
                  onClick={() =>
                    handleDownloadFile(file.filename, file.download_url)
                  }
                  className="text-gray-700 border-gray-300 hover:bg-gray-100"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Descargar
                </Button>
              </>
            )}
            {isEditable && (
              <DeleteTramiteFileConfirmationModal
                tramite_id={tramite_id}
                file={file}
                organization_id={organization_id}
                onDeleted={onDeleted}
              />
            )}
          </div>
        </div>
      ))}

      {/* File Preview Modal */}
      {previewFile && (
        <FilePreview
          file={previewFile}
          onClose={handleClosePreview}
          isOpen={isPreviewOpen}
        />
      )}
    </div>
  );
}
