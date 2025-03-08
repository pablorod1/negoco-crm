"use client";

import { Card, CardContent } from "@/components/ui/card";

import { Tooltip } from "@heroui/tooltip";
import { DocumentacionFile, User } from "@/lib/core/types";
import Image from "next/image";
import { formatDateTime } from "@/lib/core/format";
import FileCardDropdown from "./FileCardDropdown";

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

  return (
    <Card className="relative w-full">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Image
                src={getFileIcon(file) as string}
                alt={file.type}
                width={512}
                height={512}
                className="max-w-20 w-full h-full"
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
          <FileCardDropdown userData={userData as User} file={file} />
        </div>
      </CardContent>
    </Card>
  );
}
