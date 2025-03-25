import { showCustomToast } from "@/components/core/CustomToast";
import { Button } from "@heroui/button";
import { formatDate, formatFileSize } from "@/lib/core/format";
import { TramiteFile } from "@/lib/core/types";
import { downloadFile } from "@/lib/firebase/data/downloadFile";
import { CloudAlert, Download, FileIcon } from "lucide-react";
import { useCallback } from "react";
import Image from "next/image";

interface Props {
  files: TramiteFile[];
  tramite_id: string;
  organization_id: string;
}

export default function TramiteFilesList({
  files,
  tramite_id,
  organization_id,
}: Props) {
  const handleDownloadFile = useCallback(
    async (filename: string) => {
      try {
        const { success, errors } = await downloadFile(
          `tramites/${tramite_id}`,
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
    [tramite_id, organization_id]
  );

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
          <div className="flex gap-2">
            {file.download_url && (
              <Button
                variant="bordered"
                isIconOnly
                onPress={() => handleDownloadFile(file.filename)}
              >
                <Download size={20} />
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
