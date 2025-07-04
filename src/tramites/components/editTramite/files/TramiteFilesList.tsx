import { showCustomToast } from "@/core/components/CustomToast";
import { Button } from "@/core/components/ui/button";
import { formatDate, formatFileSize } from "@/core/utils/format";
import { TramiteFile } from "@/tramites/types";
import { downloadFile } from "@/core/firebase/data/downloadFile";
import { CloudAlert, Download, FileIcon } from "lucide-react";
import Image from "next/image";
import DeleteTramiteFileConfirmationModal from "./DeleteTramiteFileConfirmationModal";

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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {files.map((file) => (
        <div
          key={file.id}
          className="flex items-center justify-between p-3 border rounded-lg"
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
              <Button
                variant="outline"
                size="icon"
                onClick={() =>
                  handleDownloadFile(file.filename, file.download_url)
                }
              >
                <Download size={20} />
              </Button>
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
    </div>
  );
}
