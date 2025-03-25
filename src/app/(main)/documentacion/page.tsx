"use client";
import EmptyDocumentacion from "@/components/documentacion/EmptyDocumentacion";
import { FileGrid } from "@/components/documentacion/FileGrid";
import LoadingComponent from "@/components/documentacion/LoadingComponent";
import { useDocumentacion } from "@/lib/contexts/DocumentacionContext";
import { getSubFoldersFromFolder } from "@/lib/firebase/data/getFolders";
import { DocumentacionFile, User } from "@/lib/core/types";
import { useCallback, useEffect, useState } from "react";
import { useUser } from "@/lib/contexts/UserContext";

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
      const filesRes = await fetch(`/api/documentacion/get/files`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ folder_name: "/" }),
      });

      const recentlyFilesRes = await fetch(
        `/api/documentacion/get/recently-files`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const [
        { data: files, success: filesSuccess, error: filesError },
        foldersResponse,
        {
          data: recentlyFiles,
          success: recentlyFilesSuccess,
          error: recentlyFilesError,
        },
      ] = await Promise.all([
        filesRes.json(),
        getSubFoldersFromFolder("", userData?.organization.id as string),
        recentlyFilesRes.json(),
      ]);

      if (foldersResponse.success) {
        setFolders(foldersResponse.data as string[]);
      }

      if (filesSuccess) {
        setFiles(files as DocumentacionFile[]);
      } else {
        console.error("Error fetching files:", filesError);
        setFiles([]);
      }

      if (recentlyFilesSuccess) {
        setRecentlyFiles(recentlyFiles as DocumentacionFile[]);
      } else {
        console.error("Error fetching recently files:", recentlyFilesError);
        setRecentlyFiles([]);
      }
    } catch (error) {
      console.error("Error fetching folders:", error);
    } finally {
      setIsLoading(false);
    }
  }, [setIsLoading, userData]);

  useEffect(() => {
    return setRefreshDocumentacion(fetchFolders);
  }, [fetchFolders, setRefreshDocumentacion]);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  return (
    <>
      {isLoading ? (
        <LoadingComponent userData={userData as User} />
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
