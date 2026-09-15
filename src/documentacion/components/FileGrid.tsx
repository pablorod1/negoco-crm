"use client";
import { useState } from "react";
import {
  ArrowLeft,
  FolderInput,
  FolderOpen,
  Grid2X2,
  List,
  X,
} from "lucide-react";

import { FileCard } from "./FileCard";
import { Button } from "@/core/components/ui/button";
import { DocumentacionFile, User } from "@/core/types";
import { FolderCard } from "./FolderCard";
import UploadFileModal from "./UploadFileModal";
import SearchBar from "./SearchBar";
import DeleteFileConfirmationModal from "./DeleteFileConfirmationModal";
import { MoveFilesDialog } from "./MoveFilesDialog";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
} from "@/core/components/ui/breadcrumb";
import { SupplierFolder } from "@/documentacion/lib/supplier-folders";
import { normalizeDocumentLibraryFolderPath } from "@/core/utils/document-library-path";

interface FileGridProps {
  files?: DocumentacionFile[];
  recentlyFiles?: DocumentacionFile[];
  folders: string[];
  /** Carpetas de comercializadoras activas (reales o virtuales), sólo en la raíz. */
  supplierFolders?: SupplierFolder[];
  userData: User;
  /** Ruta completa de la carpeta que se está mostrando. */
  currentPath: string;
  /** Segmentos que se muestran en las migas, relativos a `basePath`. */
  folderPath?: string[];
  /** Carpeta bajo la que vive el explorador (vacío para la raíz de Documentación). */
  basePath?: string;
  handleBack?: () => void;
  /** Título de la cabecera cuando estamos en la raíz. */
  title?: string;
  /**
   * Explorador embebido: los enlaces a carpetas y migas navegan por callback
   * con la ruta completa en vez de cambiar la URL.
   */
  onNavigate?: (folderPath: string) => void;
}

const getBreadcrumbPath = (folders: string[], currentIndex: number): string => {
  return folders.slice(0, currentIndex + 1).join("/");
};

export function FileGrid({
  files,
  folders,
  supplierFolders = [],
  currentPath,
  folderPath,
  basePath = "",
  recentlyFiles,
  handleBack,
  userData,
  title = "Documentación",
  onNavigate,
}: FileGridProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [filesSelected, setFilesSelected] = useState<DocumentacionFile[]>([]);
  const [moveOpen, setMoveOpen] = useState(false);

  const handleSelectFile = (file: DocumentacionFile) => {
    if (filesSelected.some((f) => f.id === file.id)) {
      setFilesSelected(filesSelected.filter((f) => f.id !== file.id));
    } else {
      setFilesSelected([...filesSelected, file]);
    }
  };

  const isNonCommercialUser = userData.role !== "2";
  const isRoot = !folderPath || folderPath.length === 0;
  const hasContent =
    (files && files.length > 0) ||
    folders.length > 0 ||
    supplierFolders.length > 0 ||
    (recentlyFiles && recentlyFiles.length > 0);
  const gridClassName =
    viewMode === "grid"
      ? "grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4"
      : "space-y-2";

  const controls = (
    <div className="flex items-center gap-2">
      {filesSelected.length > 0 && (
        <div className="flex items-center gap-3 px-3 py-1.5 bg-gray-50 rounded-lg border">
          <span className="text-xs text-gray-600 font-medium">
            {filesSelected.length} seleccionado
            {filesSelected.length > 1 ? "s" : ""}
          </span>
          <Button
            variant="ghost"
            onClick={() => setMoveOpen(true)}
            className="h-9 px-3 text-gray-700 hover:bg-gray-100 hover:text-gray-900"
          >
            <FolderInput className="h-4 w-4 mr-2" />
            Mover
          </Button>
          <DeleteFileConfirmationModal
            files={filesSelected}
            userData={userData as User}
          />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Quitar selección"
            onClick={() => setFilesSelected([])}
            className="h-6 w-6 text-gray-400 hover:text-gray-600"
          >
            <X className="h-3 w-3" />
          </Button>
          <MoveFilesDialog
            open={moveOpen}
            onOpenChange={setMoveOpen}
            files={filesSelected}
            userData={userData as User}
            onMoved={() => setFilesSelected([])}
          />
        </div>
      )}

      {!onNavigate && <SearchBar recentlyFiles={recentlyFiles} />}

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
  );

  return (
    <div className="space-y-8">
      {/* Header - Clean and Minimal */}
      {!isRoot ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              size="icon"
              variant="ghost"
              onClick={handleBack}
              className="h-8 w-8 text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Breadcrumb>
              <BreadcrumbList>
                {folderPath.map((folder, index) => {
                  const path = normalizeDocumentLibraryFolderPath(
                    `${basePath}/${getBreadcrumbPath(folderPath, index)}`
                  );
                  return (
                    <BreadcrumbItem key={index}>
                      {onNavigate ? (
                        <BreadcrumbLink
                          asChild
                          className="text-gray-600 hover:text-gray-900"
                        >
                          <button
                            type="button"
                            onClick={() => onNavigate(path)}
                          >
                            {folder}
                          </button>
                        </BreadcrumbLink>
                      ) : (
                        <BreadcrumbLink
                          href={`/documentacion/${path}`}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          {folder}
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  );
                })}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          {controls}
        </div>
      ) : (
        <div className="flex items-center justify-between">
          {onNavigate ? (
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          ) : (
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          )}
          {controls}
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
            <div className={gridClassName}>
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

        {/* Supplier Folders Section */}
        {supplierFolders.length > 0 && (
          <section className="space-y-4">
            <div className="border-b border-gray-100 pb-2">
              <h2 className="text-lg font-semibold text-gray-900">
                Comercializadoras
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Una carpeta por cada comercializadora activa
              </p>
            </div>
            <div className={gridClassName}>
              {supplierFolders.map((folder) => (
                <FolderCard
                  key={`supplier-${folder.supplier.id}`}
                  name={folder.folderName}
                  currentPath={currentPath}
                  userData={userData as User}
                  supplier={folder.supplier}
                  exists={folder.exists}
                  onNavigate={onNavigate}
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
            <div className={gridClassName}>
              {folders.map((folder: string, index) => (
                <FolderCard
                  key={`folder-${index}`}
                  name={folder}
                  currentPath={currentPath}
                  userData={userData as User}
                  onNavigate={onNavigate}
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
            <div className={gridClassName}>
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

        {/* Empty folder */}
        {!hasContent && (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center mx-auto mb-4 shadow-sm border">
              <FolderOpen className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Esta carpeta está vacía
            </h3>
            <p className="text-gray-500 max-w-md mx-auto">
              {isNonCommercialUser
                ? "Sube el primer documento con el botón «Subir archivos»."
                : "Los documentos aparecerán aquí cuando el administrador los comparta."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
