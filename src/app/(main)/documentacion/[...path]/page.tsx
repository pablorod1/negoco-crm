"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSubFoldersFromFolder } from "@/lib/firebase/data/getFolders";
import { getFilesFromFolder } from "@/lib/libsql/data/documentacion/getFiles";
import { DocumentacionFile } from "@/lib/core/types";
import { useDocumentacion } from "@/contexts/DocumentacionContext";
import LoadingComponent from "@/components/documentacion/LoadingComponent";
import EmptyDocumentacion from "@/components/documentacion/EmptyDocumentacion";
import { FileGrid } from "@/components/documentacion/FileGrid";
import { showCustomToast } from "@/components/core/CustomToast";
import { CircleX } from "lucide-react";

const formatFolderPath = (rawPath: string): string[] => {
  return decodeURIComponent(rawPath).split(",").filter(Boolean);
};

const getParentPath = (currentPath: string[]): string => {
  if (currentPath.length <= 1) {
    return "/documentacion";
  }
  return `/documentacion/${currentPath.slice(0, -1).join(",")}`;
};

export default function FolderPage() {
  const router = useRouter();
  const { path } = useParams();
  const { setRefreshDocumentacion, isLoading, setIsLoading } =
    useDocumentacion();

  // Memoize the folderPath array to prevent recreating it on every render
  const folderPath = useMemo(() => formatFolderPath(path as string), [path]);
  // Memoize the joined path string to use as a dependency
  const currentPath = useMemo(() => folderPath.join("/"), [folderPath]);
  const [files, setFiles] = useState<DocumentacionFile[]>([]);
  const [folders, setFolders] = useState<string[]>([]);

  const fetchFiles = useCallback(async () => {
    setIsLoading(true);
    try {
      const [filesResponse, foldersResponse] = await Promise.all([
        getFilesFromFolder(currentPath),
        getSubFoldersFromFolder(currentPath),
      ]);

      setFiles(filesResponse as DocumentacionFile[]);
      if (foldersResponse.success) {
        setFolders(foldersResponse.data as string[]);
      }
    } catch (error) {
      showCustomToast({
        title: "Error al obtener los archivos",
        message: "Inténtalo de nuevo más tarde",
        iconColor: "var(--danger-color)",
        iconSize: 24,
        icon: CircleX,
      });
      console.error("Error obteniendo archivos:", error);
    } finally {
      setIsLoading(false);
    }
  }, [currentPath, setIsLoading]);

  useEffect(() => {
    return setRefreshDocumentacion(fetchFiles);
  }, [fetchFiles, setRefreshDocumentacion]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleBack = useCallback(() => {
    const parentPath = getParentPath(folderPath);
    router.push(parentPath);
  }, [folderPath, router]);

  return (
    <>
      {isLoading ? (
        <LoadingComponent />
      ) : files.length > 0 || folders.length > 0 ? (
        <div className="flex flex-col gap-4">
          <FileGrid
            folderPath={folderPath}
            files={files}
            folders={folders}
            currentPath={currentPath}
            handleBack={handleBack}
          />
        </div>
      ) : (
        <EmptyDocumentacion />
      )}
    </>
  );
}
