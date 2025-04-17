import { Card, CardContent } from "@/components/ui/card";
import { DocumentacionFile, User } from "@/lib/core/types";
import Image from "next/image";
import { formatDateTime } from "@/lib/core/format";
import FileCardDropdown from "./FileCardDropdown";
import { Checkbox } from "@/components/ui/checkbox";
import TooltipComponent from "../core/TooltipComponent";
import { CheckboxIndicator } from "@radix-ui/react-checkbox";
import { CircleCheck } from "lucide-react";

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
  selectedFiles,
  handleSelectFile,
}: {
  file: DocumentacionFile;
  view: "grid" | "list";
  userData: User;
  selectedFiles?: DocumentacionFile[];
  handleSelectFile?: (file: DocumentacionFile) => void;
}) {
  const isComercial = userData && userData.role === "2";
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
  const isSelected =
    selectedFiles && selectedFiles.some((f) => f.id === file.id);

  if (selectedFiles && handleSelectFile && !isComercial) {
    return (
      <Card>
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
                <TooltipComponent
                  content={file.name}
                  disabled={view === "list"}
                >
                  <h3
                    className={`block text-ellipsis overflow-hidden whitespace-nowrap font-semibold text-lg ${
                      view === "grid" ? "max-w-64 w-full" : ""
                    }`}
                  >
                    {file.name}
                  </h3>
                </TooltipComponent>
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
            <div className="flex flex-col items-end justify-between h-full gap-4">
              <FileCardDropdown userData={userData as User} file={file} />
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => handleSelectFile(file)}
                className="rounded-md size-5"
              >
                <CheckboxIndicator>
                  <CircleCheck className="h-4 w-4 text-primary-500" />
                </CheckboxIndicator>
              </Checkbox>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

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
              <TooltipComponent content={file.name} disabled={view === "list"}>
                <h3
                  className={`block text-ellipsis overflow-hidden whitespace-nowrap font-semibold text-lg ${
                    view === "grid" ? "max-w-64 w-full" : ""
                  }`}
                >
                  {file.name}
                </h3>
              </TooltipComponent>
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
          <div className="flex flex-col justify-between">
            <FileCardDropdown userData={userData as User} file={file} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
