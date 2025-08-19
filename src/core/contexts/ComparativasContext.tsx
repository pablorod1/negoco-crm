"use client";
import { createContext, useContext, useCallback, useRef } from "react";

interface ComparativasContextType {
  refreshComparativas: () => Promise<void>;
  setRefreshComparativas: (callback: () => Promise<void>) => () => void;
}

const ComparativasContext = createContext<ComparativasContextType>({
  refreshComparativas: async () => {},
  setRefreshComparativas: () => () => {},
});

export const useComparativas = () => useContext(ComparativasContext);

export function ComparativasProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const refreshCallbacks = useRef<Set<() => Promise<void>>>(new Set());

  const refresh = useCallback(async () => {
    const promises = Array.from(refreshCallbacks.current).map((callback) =>
      callback()
    );
    await Promise.all(promises);
  }, []);

  const setRefresh = useCallback((callback: () => Promise<void>) => {
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

