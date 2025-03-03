"use client";
import EmptyDocumentacion from "@/components/documentacion/EmptyDocumentacion";
import { FileGrid } from "@/components/documentacion/FileGrid";
import LoadingComponent from "@/components/documentacion/LoadingComponent";
import { useDocumentacion } from "@/contexts/DocumentacionContext";
import { getSubFoldersFromFolder } from "@/lib/firebase/data/getFolders";
import {
  getFilesFromFolder,
  getRecentlyFiles,
} from "@/lib/libsql/data/documentacion/getFiles";
import { DocumentacionFile, User } from "@/lib/core/types";
import { useCallback, useEffect, useState } from "react";
import { useUser } from "@/contexts/UserContext";

export default function DocumentacionPage() {
  const { userData } = useUser();
  const [folders, setFolders] = useState<string[]>([]);
  const [files, setFiles] = useState<DocumentacionFile[]>([]);
  const [recentlyFiles, setRecentlyFiles] = useState<DocumentacionFile[]>([]);
  const { setRefreshDocumentacion, isLoading, setIsLoading } =
    useDocumentacion();

  const fetchFolders = useCallback(async () => {
    setIsLoading(true);
    try {
      const [filesResponse, foldersResponse, recentlyFilesResponse] =
        await Promise.all([
          getFilesFromFolder("/"),
          getSubFoldersFromFolder(""),
          getRecentlyFiles(),
        ]);

      if (foldersResponse.success) {
        setFolders(foldersResponse.data as string[]);
      }

      if (filesResponse) {
        setFiles(filesResponse as DocumentacionFile[]);
      }

      if (recentlyFilesResponse) {
        setRecentlyFiles(recentlyFilesResponse as DocumentacionFile[]);
      }
    } catch (error) {
      console.error("Error fetching folders:", error);
    } finally {
      setIsLoading(false);
    }
  }, [setIsLoading]);

  useEffect(() => {
    return setRefreshDocumentacion(fetchFolders);
  }, [fetchFolders, setRefreshDocumentacion]);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  return (
    <>
      {isLoading ? (
        <LoadingComponent />
      ) : files.length > 0 || folders.length > 0 ? (
        <div className="flex flex-col gap-4">
          <FileGrid
            recentlyFiles={recentlyFiles}
            folders={folders}
            currentPath=""
            folderPath={[]}
            userData={userData as User}
          />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <EmptyDocumentacion userData={userData as User} />
        </div>
      )}
    </>
  );
}
