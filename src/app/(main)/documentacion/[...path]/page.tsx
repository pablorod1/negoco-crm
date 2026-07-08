"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { getSubFoldersFromFolder } from "@/core/firebase/data/getFolders";
import { DocumentacionFile, User } from "@/core/types";
import { useDocumentacion } from "@/core/contexts/DocumentacionContext";
import EmptyDocumentacion from "@/documentacion/components/EmptyDocumentacion";
import { FileGrid } from "@/documentacion/components/FileGrid";
import { showCustomToast } from "@/core/components/CustomToast";
import { CircleX } from "lucide-react";
import { useUser } from "@/core/contexts/UserContext";
import FullScreenLoaderComponent from "@/core/components/FullScreenLoaderComponent";
import { useTransitionRouter } from "next-view-transitions";
import { normalizeDocumentLibraryFolderPath } from "@/core/utils/document-library-path";

const formatFolderPath = (rawPath: string | string[]): string[] => {
  const decodedPath = Array.isArray(rawPath)
    ? rawPath.map((segment) => decodeURIComponent(segment)).join("/")
    : decodeURIComponent(rawPath);
  const pathWithSlashSeparators = decodedPath.includes("/")
    ? decodedPath
    : decodedPath.replaceAll(",", "/");
  const normalizedPath = normalizeDocumentLibraryFolderPath(
    pathWithSlashSeparators
  );

  return normalizedPath === "/" ? [] : normalizedPath.split("/");
};

const getParentPath = (currentPath: string[]): string => {
  if (currentPath.length <= 1) {
    return "/documentacion";
  }
  return `/documentacion/${currentPath.slice(0, -1).join("/")}`;
};

export default function FolderPage() {
  const { userData } = useUser();
  const router = useTransitionRouter();
  const { path } = useParams();
  const { setRefreshDocumentacion, isLoading, setIsLoading } =
    useDocumentacion();

  // Memoize the folderPath array to prevent recreating it on every render
  const folderPath = useMemo(
    () => formatFolderPath(path as string | string[]),
    [path]
  );
  // Memoize the joined path string to use as a dependency
  const currentPath = useMemo(() => folderPath.join("/"), [folderPath]);
  const [files, setFiles] = useState<DocumentacionFile[]>([]);
  const [folders, setFolders] = useState<string[]>([]);

  const fetchFiles = useCallback(async () => {
    setIsLoading(true);
    try {
      const filesRes = await fetch(`/api/v2/document-library`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ folder_name: currentPath }),
      });
      const [{ data: files }, foldersResponse] = await Promise.all([
        filesRes.json(),
        getSubFoldersFromFolder(
          currentPath,
          userData?.organization.id as string
        ),
      ]);

      if (files) {
        setFiles(files as DocumentacionFile[]);
      }

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
  }, [currentPath, setIsLoading, userData]);

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
    <div className="space-y-6">
      {isLoading ? (
        <FullScreenLoaderComponent />
      ) : files.length > 0 || folders.length > 0 ? (
        <FileGrid
          folderPath={folderPath}
          files={files}
          folders={folders}
          currentPath={currentPath}
          handleBack={handleBack}
          userData={userData as User}
        />
      ) : (
        <div className="flex items-center justify-center min-h-[60vh]">
          <EmptyDocumentacion userData={userData as User} />
        </div>
      )}
    </div>
  );
}
