"use client";

import { CheckCircle, CloudAlert, MoreVertical } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DocumentacionFile, User } from "@/lib/core/types";
import { downloadFile } from "@/lib/firebase/data/downloadFile";
import Image from "next/image";
import { Tooltip } from "@heroui/tooltip";
import { formatDateTime } from "@/lib/core/format";
import { showCustomToast } from "../core/CustomToast";
import DeleteFileConfirmationModal from "./DeleteFileConfirmationModal";

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
  userData,
}: {
  file: DocumentacionFile;
  view: "grid" | "list";
  userData: User;
}) {
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
        file.name,
        userData.organization.id
      );

      if (!success && errors) {
        showCustomToast({
          title: "Error al descargar el archivo",
          message: errors,
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: CloudAlert,
        });
        return;
      }

      showCustomToast({
        title: "Archivo descargado",
        message: "El archivo ha sido descargado correctamente",
        iconColor: "var(--success-color)",
        iconSize: 24,
        icon: CheckCircle,
      });
    } catch (error) {
      console.error("Error downloading file:", error);
      showCustomToast({
        title: "Error al descargar el archivo",
        message: "Inténtalo de nuevo más tarde",
        iconColor: "var(--danger-color)",
        iconSize: 24,
        icon: CloudAlert,
      });
    }
  };

  return (
    <Card className="relative w-full">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 relative">
              <Image
                src={getFileIcon(file) as string}
                alt={file.type}
                layout="fill"
                objectFit="contain"
              />
            </div>
            <div className="w-full">
              <Tooltip
                color="primary"
                size="lg"
                radius="full"
                content={file.name}
                isDisabled={view === "list"}
              >
                <h3
                  className={`block text-ellipsis overflow-hidden whitespace-nowrap font-semibold text-lg ${
                    view === "grid" ? "max-w-48 w-full" : ""
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
              <DeleteFileConfirmationModal userData={userData} file={file} />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
