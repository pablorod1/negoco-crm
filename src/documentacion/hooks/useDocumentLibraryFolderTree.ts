import { useCallback, useEffect, useState } from "react";

import { getAllFoldersWithPaths } from "@/core/firebase/data/getFolders";
import { useDocumentacion } from "@/core/contexts/DocumentacionContext";
import { useUser } from "@/core/contexts/UserContext";
import { useDocumentLibrarySuppliers } from "@/documentacion/contexts/DocumentLibrarySuppliersContext";
import { buildFolderTree, FolderTree } from "@/documentacion/lib/folder-tree";

const EMPTY_TREE: FolderTree = { supplierFolders: [], otherFolders: [] };

/**
 * Árbol completo de carpetas (Storage + virtuales de comercializadoras),
 * recargado cuando Documentación cambia.
 */
export function useDocumentLibraryFolderTree() {
  const { userData } = useUser();
  const { suppliers } = useDocumentLibrarySuppliers();
  const { setRefreshDocumentacion } = useDocumentacion();
  const [tree, setTree] = useState<FolderTree>(EMPTY_TREE);
  const [loading, setLoading] = useState(true);

  const organizationId = userData?.organization.id;

  const fetchTree = useCallback(async () => {
    if (!organizationId) return;

    try {
      const { success, data } = await getAllFoldersWithPaths(organizationId);
      setTree(buildFolderTree(success && data ? data : [], suppliers));
    } catch (error) {
      console.error("Error fetching folders:", error);
      setTree(buildFolderTree([], suppliers));
    } finally {
      setLoading(false);
    }
  }, [organizationId, suppliers]);

  useEffect(() => {
    return setRefreshDocumentacion(fetchTree);
  }, [fetchTree, setRefreshDocumentacion]);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  return { tree, loading, refetch: fetchTree };
}
