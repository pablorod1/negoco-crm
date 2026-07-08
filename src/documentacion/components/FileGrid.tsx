"use client";
import { useState } from "react";
import { ArrowLeft, Grid2X2, List, X } from "lucide-react";

import { FileCard } from "./FileCard";
import { Button } from "@/core/components/ui/button";
import { DocumentacionFile, User } from "@/core/types";
import { FolderCard } from "./FolderCard";
import UploadFileModal from "./UploadFileModal";
import SearchBar from "./SearchBar";
import DeleteFileConfirmationModal from "./DeleteFileConfirmationModal";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
} from "@/core/components/ui/breadcrumb";

interface FileGridProps {
  files?: DocumentacionFile[];
  recentlyFiles?: DocumentacionFile[];
  folders: string[];
  userData: User;
  currentPath: string;
  folderPath?: string[];
  handleBack?: () => void;
}

const getBreadcrumbPath = (folders: string[], currentIndex: number): string => {
  return folders.slice(0, currentIndex + 1).join("/");
};

export function FileGrid({
  files,
  folders,
  currentPath,
  folderPath,
  recentlyFiles,
  handleBack,
  userData,
}: FileGridProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [filesSelected, setFilesSelected] = useState<DocumentacionFile[]>([]);

  const handleSelectFile = (file: DocumentacionFile) => {
    if (filesSelected.some((f) => f.id === file.id)) {
      setFilesSelected(filesSelected.filter((f) => f.id !== file.id));
    } else {
      setFilesSelected([...filesSelected, file]);
    }
  };

  const isNonCommercialUser = userData.role !== "2";
  const hasContent =
    (files && files.length > 0) ||
    folders.length > 0 ||
    (recentlyFiles && recentlyFiles.length > 0);

  return (
    <div className="space-y-8">
      {/* Header - Clean and Minimal */}
      {folderPath && folderPath.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              size="icon"
              variant="ghost"
              onClick={handleBack}
              disabled={folderPath ? folderPath.length === 0 : false}
              className="h-8 w-8 text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Breadcrumb>
              <BreadcrumbList>
                {folderPath.map((folder, index) => (
                  <BreadcrumbItem key={index}>
                    <BreadcrumbLink
                      href={`/documentacion/${getBreadcrumbPath(folderPath, index)}`}
                      className="text-gray-600 hover:text-gray-900"
                    >
                      {folder}
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          {/* Controls - Right Side */}
          <div className="flex items-center gap-2">
            {filesSelected.length > 0 && (
              <div className="flex items-center gap-3 px-3 py-1.5 bg-gray-50 rounded-lg border">
                <span className="text-xs text-gray-600 font-medium">
                  {filesSelected.length} seleccionado
                  {filesSelected.length > 1 ? "s" : ""}
                </span>
                <DeleteFileConfirmationModal
                  files={filesSelected}
                  userData={userData as User}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setFilesSelected([])}
                  className="h-6 w-6 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}

            <SearchBar recentlyFiles={recentlyFiles} />

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
              className="h-8 w-8 text-gray-500 hover:text-gray-700"
            >
              {viewMode === "grid" ? (
                <List className="h-4 w-4" />
              ) : (
                <Grid2X2 className="h-4 w-4" />
              )}
            </Button>

            {isNonCommercialUser && (
              <UploadFileModal initialFolderPath={currentPath} />
            )}
          </div>
        </div>
      )}

      {/* Main Content - Only on root page */}
      {(!folderPath || folderPath.length === 0) && hasContent && (
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Documentación</h1>
          <div className="flex items-center gap-2">
            {filesSelected.length > 0 && (
              <div className="flex items-center gap-3 px-3 py-1.5 bg-gray-50 rounded-lg border">
                <span className="text-xs text-gray-600 font-medium">
                  {filesSelected.length} seleccionado
                  {filesSelected.length > 1 ? "s" : ""}
                </span>
                <DeleteFileConfirmationModal
                  files={filesSelected}
                  userData={userData as User}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setFilesSelected([])}
                  className="h-6 w-6 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}

            <SearchBar recentlyFiles={recentlyFiles} />

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
              className="h-8 w-8 text-gray-500 hover:text-gray-700"
            >
              {viewMode === "grid" ? (
                <List className="h-4 w-4" />
              ) : (
                <Grid2X2 className="h-4 w-4" />
              )}
            </Button>

            {isNonCommercialUser && (
              <UploadFileModal initialFolderPath={currentPath} />
            )}
          </div>
        </div>
      )}
      {/* Content Sections */}
      <div className="space-y-12">
        {/* Recently Files Section */}
        {recentlyFiles && recentlyFiles.length > 0 && (
          <section className="space-y-4">
            <div className="border-b border-gray-100 pb-2">
              <h2 className="text-lg font-semibold text-gray-900">
                Archivos recientes
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {recentlyFiles.length} archivo
                {recentlyFiles.length > 1 ? "s" : ""} actualizado
                {recentlyFiles.length > 1 ? "s" : ""} recientemente
              </p>
            </div>
            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4"
                  : "space-y-2"
              }
            >
              {recentlyFiles.map((file: DocumentacionFile, index) => (
                <FileCard
                  view={viewMode}
                  key={`recent-${file.id}-${index}`}
                  file={file}
                  userData={userData}
                  handleSelectFile={handleSelectFile}
                  selectedFiles={filesSelected}
                />
              ))}
            </div>
          </section>
        )}

        {/* Folders Section */}
        {folders.length > 0 && (
          <section className="space-y-4">
            <div className="border-b border-gray-100 pb-2">
              <h2 className="text-lg font-semibold text-gray-900">Carpetas</h2>
              <p className="text-sm text-gray-500 mt-1">
                {folders.length} carpeta{folders.length > 1 ? "s" : ""}{" "}
                disponible{folders.length > 1 ? "s" : ""}
              </p>
            </div>
            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4"
                  : "space-y-2"
              }
            >
              {folders.map((folder: string, index) => (
                <FolderCard
                  key={`folder-${index}`}
                  name={folder}
                  currentPath={currentPath}
                  userData={userData as User}
                />
              ))}
            </div>
          </section>
        )}

        {/* Files Section */}
        {files && files.length > 0 && (
          <section className="space-y-4">
            <div className="border-b border-gray-100 pb-2">
              <h2 className="text-lg font-semibold text-gray-900">Archivos</h2>
              <p className="text-sm text-gray-500 mt-1">
                {files.length} archivo{files.length > 1 ? "s" : ""} en esta
                ubicación
              </p>
            </div>
            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4"
                  : "space-y-2"
              }
            >
              {files.map((file: DocumentacionFile, index) => (
                <FileCard
                  userData={userData}
                  view={viewMode}
                  key={`file-${file.id}-${index}`}
                  file={file}
                  handleSelectFile={handleSelectFile}
                  selectedFiles={filesSelected}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
