"use client";

import { useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { User } from "@/core/types";
import { FileGrid } from "@/documentacion/components/FileGrid";
import { useUser } from "@/core/contexts/UserContext";
import FullScreenLoaderComponent from "@/core/components/FullScreenLoaderComponent";
import { useTransitionRouter } from "next-view-transitions";
import { normalizeDocumentLibraryFolderPath } from "@/core/utils/document-library-path";
import { useDocumentLibraryFolder } from "@/documentacion/hooks/useDocumentLibraryFolder";

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

  // Memoize the folderPath array to prevent recreating it on every render
  const folderPath = useMemo(
    () => formatFolderPath(path as string | string[]),
    [path]
  );
  // Memoize the joined path string to use as a dependency
  const currentPath = useMemo(() => folderPath.join("/"), [folderPath]);
  const { files, folders, loading } = useDocumentLibraryFolder(
    currentPath,
    userData?.organization.id
  );

  const handleBack = useCallback(() => {
    const parentPath = getParentPath(folderPath);
    router.push(parentPath);
  }, [folderPath, router]);

  return (
    <div className="space-y-6">
      {loading ? (
        <FullScreenLoaderComponent />
      ) : (
        <FileGrid
          folderPath={folderPath}
          files={files}
          folders={folders}
          currentPath={currentPath}
          handleBack={handleBack}
          userData={userData as User}
        />
      )}
    </div>
  );
}
