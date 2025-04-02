import { showCustomToast } from "@/components/core/CustomToast";
import { formatDateTime, formatFileSize } from "@/lib/core/format";
import { ComparativaFile } from "@/lib/core/types";
import { downloadFile } from "@/lib/firebase/data/downloadFile";
import { Button } from "@heroui/button";
import { CloudAlert, Download, FileIcon } from "lucide-react";
import Image from "next/image";
import { useCallback, useMemo } from "react";
import DeleteComparativaFileConfirmationModal from "./DeleteComparativaFileConfirmationModal";

interface FilesListProps {
  files: ComparativaFile[];
  comparativa_id: string;
  organization_id: string;
  isComercial: boolean;
  onDeleted: () => void;
}

export const FilesList = ({
  files,
  comparativa_id,
  organization_id,
  isComercial,
  onDeleted,
}: FilesListProps) => {
  const handleDownloadFile = useCallback(
    async (filename: string) => {
      try {
        const { success, errors } = await downloadFile(
          `comparativas/${comparativa_id}`,
          filename,
          organization_id
        );

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
    [comparativa_id, organization_id]
  );

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
          {file.download_url && (
            <Button
              variant="bordered"
              isIconOnly
              onPress={() => handleDownloadFile(file.filename as string)}
            >
              <Download className="h-4 w-4" />
            </Button>
          )}
          {!isComercial && (
            <DeleteComparativaFileConfirmationModal
              comparativa_id={comparativa_id}
              filename={file.filename}
              organization_id={organization_id}
              onDeleted={onDeleted}
            />
          )}
        </div>
      </div>
    ));
  }, [
    files,
    handleDownloadFile,
    comparativa_id,
    organization_id,
    isComercial,
    onDeleted,
  ]);

  if (files.length === 0) {
    return <p className="text-muted-foreground">No hay archivos adjuntos.</p>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{fileElements}</div>
  );
};
