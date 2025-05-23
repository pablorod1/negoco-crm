import { Card, CardContent } from "@/components/ui/card";
import { TramiteFile } from "@/lib/core/types";
import Image from "next/image";
import { formatDateTime, formatFileSize } from "@/lib/core/format";
import TooltipComponent from "@/components/core/TooltipComponent";

export function ClientFileCard({
  file,
  view,
}: {
  file: TramiteFile;
  view: "grid" | "list";
}) {
  const getFileIcon = (file: TramiteFile) => {
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
                alt={file.extension}
                width={512}
                height={512}
                className="max-w-20 w-full h-full"
              />
            </div>
            <div className="w-full">
              <TooltipComponent
                content={file.filename}
                disabled={view === "list"}
              >
                <h3
                  className={`block text-ellipsis overflow-hidden whitespace-nowrap font-semibold text-lg ${
                    view === "grid" ? "max-w-64 w-full" : ""
                  }`}
                >
                  {file.filename}
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
          {/* <div className="flex flex-col justify-between">
            <FileCardDropdown userData={userData as User} file={file} />
          </div> */}
        </div>
      </CardContent>
    </Card>
  );
}
