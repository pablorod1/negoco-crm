"use client";

import { MoreVertical } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DocumentacionFile } from "@/lib/types";
import { deleteFile } from "@/lib/firebase/data/deleteFile";
import toast from "react-hot-toast";
import { useDocumentacion } from "@/contexts/DocumentacionContext";
import { downloadFile } from "@/lib/firebase/data/downloadFile";
import Image from "next/image";
import { Tooltip } from "@heroui/tooltip";
import { formatDateTime } from "@/lib/format";

function formatFileSize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

export function FileCard({
  file,
  view,
}: {
  file: DocumentacionFile;
  view: "grid" | "list";
}) {
  const { refreshDocumentacion } = useDocumentacion();

  const getFileIcon = (file: DocumentacionFile) => {
    switch (file.extension) {
      case "pdf":
        return "/file-icons/pdf.png";
      case "doc":
      case "docx":
        return "/file-icons/word.png";
      case "xls":
      case "xlsx":
        return "/file-icons/excel.png";
      case "ppt":
      case "pptx":
        return "/file-icons/powerpoint.png";
      case "jpg":
      case "JPG":
      case "jpeg":
      case "png":
      case "webp":
      case "svg":
      case "gif":
        return file.preview_url;
      case "zip":
      case "rar":
        return "/file-icons/zip.png";
      case "txt":
        return "/file-icons/txt.png";
      default:
        return "/file-icons/file.png";
    }
  };

  const handleDownload = async () => {
    try {
      const { success, errors } = await downloadFile(
        file.folder_name,
        file.name
      );

      if (!success) {
        toast.error(errors);
        return;
      }

      toast.success("Archivo descargado correctamente");
    } catch (error) {
      console.error("Error downloading file:", error);
      toast.error("Error descargando archivo");
    }
  };

  const handleDelete = async () => {
    try {
      const { success, errors } = await deleteFile(
        file.folder_name,
        file.name,
        file.id
      );

      if (!success) {
        toast.error(errors);
        return;
      }

      toast.success("Archivo eliminado correctamente");
      refreshDocumentacion();
    } catch (error) {
      console.error("Error eliminando archivo:", error);
      toast.error("Error eliminando archivo");
    }
  };

  return (
    <Card className="relative overflow-hidden w-full">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 relative">
              <Image
                src={getFileIcon(file) as string}
                alt={file.type}
                layout="fill"
                objectFit="contain"
              />
            </div>
            <div>
              <Tooltip
                color="primary"
                size="lg"
                radius="full"
                content={file.name}
                isDisabled={view === "list"}
              >
                <h3
                  className={`font-semibold text-lg ${
                    view === "grid"
                      ? "max-w-80 text-ellipsis overflow-hidden whitespace-nowrap"
                      : ""
                  }`}
                >
                  {file.name}
                </h3>
              </Tooltip>
              {file.size && (
                <p className="text-sm text-muted-foreground">
                  {formatFileSize(file.size)}
                </p>
              )}
              {file.upload_date && (
                <p className="text-xs text-muted-foreground">
                  Fecha de subida: {formatDateTime(file.upload_date)}
                </p>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="cursor-pointer text-primary"
                onClick={handleDownload}
              >
                Download
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer text-danger"
                onClick={handleDelete}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
