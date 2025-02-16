"use client";
import { useState } from "react";
import { ArrowLeft, Grid2X2, List } from "lucide-react";

import { FileCard } from "./FileCard";
import { Button } from "@heroui/react";
import { DocumentacionFile } from "@/lib/types";
import { FolderCard } from "./FolderCard";
import { BreadcrumbItem, Breadcrumbs, Divider } from "@heroui/react";
import UploadFileModal from "./UploadFileModal";
import SearchBar from "./SearchBar";

interface FileGridProps {
  files?: DocumentacionFile[];
  recentlyFiles?: DocumentacionFile[];
  folders: string[];
  currentPath: string;
  folderPath?: string[];
  handleBack?: () => void;
}

const getBreadcrumbPath = (folders: string[], currentIndex: number): string => {
  return folders.slice(0, currentIndex + 1).join(",");
};

export function FileGrid({
  files,
  folders,
  currentPath,
  folderPath,
  recentlyFiles,
  handleBack,
}: FileGridProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4">
            <Button
              size="sm"
              radius="full"
              variant="ghost"
              isIconOnly
              color="primary"
              onPress={handleBack}
              isDisabled={folderPath ? folderPath.length === 0 : false}
              className="transition-opacity"
              title="Go to parent folder"
            >
              <ArrowLeft width={16} height={16} />
            </Button>
          </div>
          <Breadcrumbs size="lg">
            {folderPath &&
              folderPath.map((folder, index) => (
                <BreadcrumbItem
                  key={`${folder}-${index}`}
                  href={`/documentacion/${getBreadcrumbPath(
                    folderPath,
                    index
                  )}`}
                >
                  {folder}
                </BreadcrumbItem>
              ))}
          </Breadcrumbs>
        </div>
        <div className="flex items-center gap-4">
          <SearchBar recentlyFiles={recentlyFiles} />
          <Button
            variant="flat"
            size="sm"
            isIconOnly
            className="px-2 bg-transparent"
            onPress={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
          >
            {viewMode === "grid" ? (
              <List className="h-4 w-4" />
            ) : (
              <Grid2X2 className="h-4 w-4" />
            )}
          </Button>
          <UploadFileModal />
        </div>
      </div>
      <div className="flex flex-col gap-12 w-full">
        {recentlyFiles && recentlyFiles.length > 0 && (
          <div className="flex flex-col gap-4 w-full">
            <h2 className="text-xl font-semibold text-[var(--primary-color-800)]">
              Archivos recientes
            </h2>
            <Divider />
            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-1 md:grid-cols-2  xl:grid-cols-3 gap-4 items-stretch"
                  : "space-y-2"
              }
            >
              {recentlyFiles.map((file: DocumentacionFile, index) => (
                <FileCard view={viewMode} key={index} file={file} />
              ))}
            </div>
          </div>
        )}
        {folders.length > 0 && (
          <div className="flex flex-col gap-4 w-full">
            <h2 className="text-xl font-semibold text-[var(--primary-color-800)]">
              Carpetas
            </h2>
            <Divider />
            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-1 md:grid-cols-2  xl:grid-cols-3 gap-4 items-stretch"
                  : "space-y-2"
              }
            >
              {folders.map((folder: string, index) => (
                <FolderCard
                  key={index}
                  name={folder}
                  currentPath={currentPath}
                />
              ))}
            </div>
          </div>
        )}
        {files && files.length > 0 && (
          <div className="flex flex-col gap-4 w-full">
            <h2 className="text-xl font-semibold text-[var(--primary-color-800)]">
              Archivos
            </h2>
            <Divider />
            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-1 md:grid-cols-2  xl:grid-cols-3 gap-4 items-stretch"
                  : "space-y-2"
              }
            >
              {files.map((file: DocumentacionFile, index) => (
                <FileCard view={viewMode} key={index} file={file} />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
