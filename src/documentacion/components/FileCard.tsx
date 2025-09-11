import { Card, CardContent } from "@/core/components/ui/card";
import { DocumentacionFile, User } from "@/core/types";
import Image from "next/image";
import { formatDateTime } from "@/core/utils/format";
import FileCardDropdown from "./FileCardDropdown";
import { Checkbox } from "@/core/components/ui/checkbox";
import TooltipComponent from "@/core/components/TooltipComponent";
import { CheckboxIndicator } from "@radix-ui/react-checkbox";
import { CircleCheck, Clock, HardDrive } from "lucide-react";

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
  const isSelected =
    selectedFiles && selectedFiles.some((f) => f.id === file.id);
  const canSelect = selectedFiles && handleSelectFile && !isComercial;

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
    <Card
      className={`group hover:shadow-md transition-all duration-200 border-gray-200 ${
        isSelected
          ? "ring-2 ring-blue-500 border-blue-200"
          : "hover:border-gray-300"
      }`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* File Icon */}
          <div className="flex-shrink-0">
            <Image
              src={getFileIcon(file) as string}
              alt={file.type}
              width={48}
              height={48}
              className="w-12 h-12 object-contain"
            />
          </div>

          {/* File Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <TooltipComponent
                  content={file.name}
                  disabled={view === "list"}
                >
                  <h3 className="font-semibold text-gray-900 truncate group-hover:text-gray-700 transition-colors">
                    {file.name}
                  </h3>
                </TooltipComponent>

                {/* Primary Metadata - Always Visible */}
                {file.size && (
                  <div className="flex items-center gap-1 mt-1">
                    <HardDrive className="h-3 w-3 text-gray-400" />
                    <span className="text-sm text-gray-500">
                      {formatFileSize(file.size)}
                    </span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <FileCardDropdown userData={userData as User} file={file} />
                {canSelect && (
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => handleSelectFile(file)}
                    className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                  >
                    <CheckboxIndicator>
                      <CircleCheck className="h-3 w-3 text-white" />
                    </CheckboxIndicator>
                  </Checkbox>
                )}
              </div>
            </div>

            {/* Secondary Metadata - On Hover */}
            <div className="opacity-0 group-hover:opacity-100 transition-opacity mt-2">
              {file.upload_date && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-gray-400" />
                  <span className="text-xs text-gray-500">
                    {formatDateTime(file.upload_date)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
