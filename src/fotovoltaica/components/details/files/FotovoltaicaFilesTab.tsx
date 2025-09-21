import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/core/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/core/components/ui/table";
import { formatFileSize, formatDate } from "@/core/utils/format";
import { FileText, Download, Eye, CloudAlert } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { User } from "@/core/types";
import Image from "next/image";
import UploadFotovoltaicaFilesDialog from "./UploadFotovoltaicaFilesDialog";
import { downloadFile } from "@/core/firebase/data/downloadFile";
import { showCustomToast } from "@/core/components/CustomToast";
import { FotovoltaicaVM, FotovoltaicaFile } from "@/fotovoltaica/types";
import { FileData } from "@/types/files";
import { useState } from "react";
import FilePreview from "@/core/components/FilePreview/FilePreview";

interface Props {
  fotovoltaica: FotovoltaicaVM;
  userData: User;
  onSubmit: () => void;
}

const getFileIcon = (file: FotovoltaicaFile) => {
  switch (file.extension) {
    case "pdf":
      return (
        <Image
          src="/file-icons/pdf.png"
          alt="PDF Icon"
          className="h-8 w-8"
          width={512}
          height={512}
        />
      );
    case "doc":
    case "docx":
      return (
        <Image
          src="/file-icons/word.png"
          alt="Word Icon"
          className="h-8 w-8"
          width={512}
          height={512}
        />
      );

    case "xls":
    case "xlsx":
      return (
        <Image
          src="/file-icons/excel.png"
          alt="Excel Icon"
          className="h-8 w-8"
          width={512}
          height={512}
        />
      );
    case "txt":
      return (
        <Image
          src="/file-icons/txt.png"
          alt="Text Icon"
          className="h-8 w-8"
          width={512}
          height={512}
        />
      );
    case "zip":
    case "7z":
    case "rar":
      return (
        <Image
          src="/file-icons/zip.png"
          alt="Zip Icon"
          className="h-8 w-8"
          width={512}
          height={512}
        />
      );
    case "jpg":
    case "jpeg":
    case "png":
    case "svg":
      return (
        <Image
          src="/file-icons/file.png"
          alt="Image Icon"
          className="h-8 w-8"
          width={512}
          height={512}
        />
      );
    default:
      return <FileText className="h-8 w-8" />;
  }
};

export default function FotovoltaicaFilesTab({
  fotovoltaica,
  userData,
  onSubmit,
}: Props) {
  const isCompleted = fotovoltaica.status === "completed";
  const isRejected = fotovoltaica.status === "rejected";
  const isPending = fotovoltaica.status === "pending";
  const isComercial = userData.role === "2";

  const [previewFile, setPreviewFile] = useState<FileData | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const canUploadFiles =
    isPending || (!isCompleted && !isRejected && !isComercial);
  const handleDownloadFile = async (file: FotovoltaicaFile) => {
    try {
      const { success, errors } = await downloadFile(
        file.download_url,
        file.filename
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
  };

  const handlePreviewFile = (file: FotovoltaicaFile) => {
    // Convert FotovoltaicaFile to FileData format
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
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Archivos Adjuntos
            </span>
            {canUploadFiles ? (
              <UploadFotovoltaicaFilesDialog
                fotovoltaica={fotovoltaica}
                userData={userData}
                onSubmit={onSubmit}
              />
            ) : null}
          </CardTitle>
          <CardDescription>
            Documentos y archivos relacionados con la solicitud
          </CardDescription>
        </CardHeader>
        <CardContent>
          {fotovoltaica.files.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tamaño</TableHead>
                  <TableHead>Fecha de Subida</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fotovoltaica.files.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {getFileIcon(file)}
                        {file.filename}
                      </div>
                    </TableCell>
                    <TableCell>{formatFileSize(file.size)}</TableCell>
                    <TableCell>{formatDate(file.upload_date)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
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
                              onClick={() => handleDownloadFile(file)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No hay archivos adjuntos</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* File Preview Modal */}
      {previewFile && (
        <FilePreview
          file={previewFile}
          onClose={handleClosePreview}
          isOpen={isPreviewOpen}
        />
      )}
    </>
  );
}
