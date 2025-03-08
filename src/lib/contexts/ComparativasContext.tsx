"use client";
import { createContext, useContext, useCallback, useRef } from "react";

interface ComparativasContextType {
  refreshComparativas: () => void;
  setRefreshComparativas: (callback: () => void) => () => void;
}

const ComparativasContext = createContext<ComparativasContextType>({
  refreshComparativas: () => {},
  setRefreshComparativas: () => () => {},
});

export const useComparativas = () => useContext(ComparativasContext);

export function ComparativasProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const refreshCallbacks = useRef<Set<() => void>>(new Set());

  const refresh = useCallback(() => {
    refreshCallbacks.current.forEach((callback) => {
      callback();
    });
  }, []);

  const setRefresh = useCallback((callback: () => void) => {
    refreshCallbacks.current.add(callback);

    // Return cleanup function to remove the callback
    return () => {
      refreshCallbacks.current.delete(callback);
    };
  }, []);

  return (
    <ComparativasContext.Provider
      value={{
        refreshComparativas: refresh,
        setRefreshComparativas: setRefresh,
      }}
    >
      {children}
    </ComparativasContext.Provider>
  );
}
