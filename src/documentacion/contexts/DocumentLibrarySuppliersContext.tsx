"use client";

import { createContext, useContext } from "react";

import { ComercializadoraVM } from "@/comercializadoras/types";
import { useActiveEnergySuppliers } from "@/comercializadoras/hooks/useActiveEnergySuppliers";

interface DocumentLibrarySuppliersContextType {
  suppliers: ComercializadoraVM[];
  loading: boolean;
}

/**
 * Comercializadoras activas que Documentación pinta como carpetas. Se cargan
 * una sola vez para la página, el sidebar y el selector de carpeta al subir.
 */
const DocumentLibrarySuppliersContext =
  createContext<DocumentLibrarySuppliersContextType>({
    suppliers: [],
    loading: false,
  });

export function DocumentLibrarySuppliersProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { activeSuppliers, loading } = useActiveEnergySuppliers();

  return (
    <DocumentLibrarySuppliersContext.Provider
      value={{ suppliers: activeSuppliers, loading }}
    >
      {children}
    </DocumentLibrarySuppliersContext.Provider>
  );
}

export const useDocumentLibrarySuppliers = () =>
  useContext(DocumentLibrarySuppliersContext);
