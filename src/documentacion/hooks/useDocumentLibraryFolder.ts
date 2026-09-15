import { useCallback, useEffect, useState } from "react";
import { CircleX } from "lucide-react";

import { getSubFoldersFromFolder } from "@/core/firebase/data/getFolders";
import { useDocumentacion } from "@/core/contexts/DocumentacionContext";
import { showCustomToast } from "@/core/components/CustomToast";
import { DocumentacionFile } from "@/core/types";

/**
 * Ficheros (Turso) y subcarpetas (Storage) de una carpeta de Documentación.
 * Se registra en el contexto para recargarse tras subir o borrar.
 */
export function useDocumentLibraryFolder(
  folderPath: string,
  organizationId: string | undefined
) {
  const { setRefreshDocumentacion } = useDocumentacion();
  const [files, setFiles] = useState<DocumentacionFile[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFolder = useCallback(async () => {
    if (!organizationId) return;

    setLoading(true);
    try {
      const filesRes = await fetch(`/api/v2/document-library`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ folder_name: folderPath }),
      });
      const [{ data: files }, foldersResponse] = await Promise.all([
        filesRes.json(),
        getSubFoldersFromFolder(folderPath, organizationId),
      ]);

      setFiles(files ? (files as DocumentacionFile[]) : []);
      setFolders(
        foldersResponse.success ? (foldersResponse.data as string[]) : []
      );
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
      setLoading(false);
    }
  }, [folderPath, organizationId]);

  useEffect(() => {
    return setRefreshDocumentacion(fetchFolder);
  }, [fetchFolder, setRefreshDocumentacion]);

  useEffect(() => {
    fetchFolder();
  }, [fetchFolder]);

  return { files, folders, loading, refetch: fetchFolder };
}
