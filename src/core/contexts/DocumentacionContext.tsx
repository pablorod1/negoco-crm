"use client";
import {
  createContext,
  useContext,
  useCallback,
  useRef,
  useState,
} from "react";

interface DocumentacionContextType {
  refreshDocumentacion: () => void;
  setRefreshDocumentacion: (callback: () => void) => () => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const DocumentacionContext = createContext<DocumentacionContextType>({
  refreshDocumentacion: () => {},
  setRefreshDocumentacion: () => () => {},
  isLoading: false,
  setIsLoading: () => {},
});

export function DocumentacionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const refreshCallbacks = useRef<Set<() => void>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(() => {
    refreshCallbacks.current.forEach((callback) => callback());
  }, []);

  const setRefresh = useCallback((callback: () => void) => {
    refreshCallbacks.current.add(callback);
    return () => {
      refreshCallbacks.current.delete(callback);
    };
  }, []);

  return (
    <DocumentacionContext.Provider
      value={{
        refreshDocumentacion: refresh,
        setRefreshDocumentacion: setRefresh,
        isLoading,
        setIsLoading,
      }}
    >
      {children}
    </DocumentacionContext.Provider>
  );
}

export const useDocumentacion = () => useContext(DocumentacionContext);

