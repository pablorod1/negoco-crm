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
import Link from "next/link";
import { downloadFile } from "@/core/firebase/data/downloadFile";
import { showCustomToast } from "@/core/components/CustomToast";
import { FotovoltaicaVM, FotovoltaicaFile } from "@/fotovoltaica/types";

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
  return (
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
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleDownloadFile(file)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>

                      {file.preview_url && (
                        <Link
                          href={file.download_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="outline" size="icon">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                      )}
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
  );
}
