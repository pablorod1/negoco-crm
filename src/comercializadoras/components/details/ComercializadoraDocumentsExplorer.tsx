"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { FileGrid } from "@/documentacion/components/FileGrid";
import {
  DocumentacionProvider,
  useDocumentacion,
} from "@/core/contexts/DocumentacionContext";
import { DocumentLibrarySuppliersProvider } from "@/documentacion/contexts/DocumentLibrarySuppliersContext";
import { useDocumentLibraryFolder } from "@/documentacion/hooks/useDocumentLibraryFolder";
import { resolveSupplierFolderName } from "@/documentacion/lib/supplier-folders";
import { getSubFoldersFromFolder } from "@/core/firebase/data/getFolders";
import { normalizeDocumentLibraryFolderPath } from "@/core/utils/document-library-path";
import FullScreenLoaderComponent from "@/core/components/FullScreenLoaderComponent";
import { User } from "@/core/types";

interface ComercializadoraDocumentsExplorerProps {
  supplierName: string;
  userData: User;
  /** Se llama tras subir o borrar para refrescar las métricas del detalle. */
  onChange?: () => void;
}

/** Ruta relativa a la carpeta de la comercializadora ("" en su raíz). */
function toRelativePath(fullPath: string, basePath: string): string {
  if (fullPath === basePath) return "";
  return fullPath.startsWith(`${basePath}/`)
    ? fullPath.slice(basePath.length + 1)
    : "";
}

function SupplierFolderExplorer({
  basePath,
  userData,
  onChange,
}: {
  basePath: string;
  userData: User;
  onChange?: () => void;
}) {
  const { setRefreshDocumentacion } = useDocumentacion();
  const [relativePath, setRelativePath] = useState("");
  const currentPath = normalizeDocumentLibraryFolderPath(
    `${basePath}/${relativePath}`
  );
  const folderPath = useMemo(
    () => (relativePath ? relativePath.split("/") : []),
    [relativePath]
  );
  const { files, folders, loading } = useDocumentLibraryFolder(
    currentPath,
    userData.organization.id
  );

  useEffect(() => {
    if (!onChange) return;
    return setRefreshDocumentacion(onChange);
  }, [onChange, setRefreshDocumentacion]);

  const handleNavigate = useCallback(
    (fullPath: string) => setRelativePath(toRelativePath(fullPath, basePath)),
    [basePath]
  );

  const handleBack = useCallback(() => {
    setRelativePath(folderPath.slice(0, -1).join("/"));
  }, [folderPath]);

  if (loading) {
    return <FullScreenLoaderComponent />;
  }

  return (
    <FileGrid
      title="Documentos"
      basePath={basePath}
      folderPath={folderPath}
      files={files}
      folders={folders}
      currentPath={currentPath}
      handleBack={handleBack}
      onNavigate={handleNavigate}
      userData={userData}
    />
  );
}

/**
 * La carpeta de la comercializadora en Documentación, embebida en su detalle.
 * Es la misma carpeta que se ve en /documentacion: si aún no existe se crea
 * con la primera subida.
 */
export function ComercializadoraDocumentsExplorer({
  supplierName,
  userData,
  onChange,
}: ComercializadoraDocumentsExplorerProps) {
  const organizationId = userData.organization.id;
  const [basePath, setBasePath] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getSubFoldersFromFolder("", organizationId)
      .then((response) => {
        if (cancelled) return;
        const rootFolders = response.success ? (response.data as string[]) : [];
        setBasePath(resolveSupplierFolderName(rootFolders, supplierName).folderName);
      })
      .catch((error) => {
        console.error("Error resolviendo la carpeta de la comercializadora:", error);
        if (!cancelled) {
          setBasePath(normalizeDocumentLibraryFolderPath(supplierName));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [organizationId, supplierName]);

  if (basePath === null) {
    return <FullScreenLoaderComponent />;
  }

  return (
    <DocumentacionProvider>
      <DocumentLibrarySuppliersProvider>
        <SupplierFolderExplorer
          basePath={basePath}
          userData={userData}
          onChange={onChange}
        />
      </DocumentLibrarySuppliersProvider>
    </DocumentacionProvider>
  );
}
