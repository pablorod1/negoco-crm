"use client";
import { createContext, useContext, useCallback, useRef } from "react";

interface FotovoltaicasContextType {
  refreshFotovoltaicas: () => Promise<void>;
  setRefreshFotovoltaicas: (callback: () => Promise<void>) => () => void;
}

const FotovoltaicasContext = createContext<FotovoltaicasContextType>({
  refreshFotovoltaicas: async () => {},
  setRefreshFotovoltaicas: () => () => {},
});

export const useFotovoltaicas = () => useContext(FotovoltaicasContext);

export function FotovoltaicasProvider({
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
    <FotovoltaicasContext.Provider
      value={{
        refreshFotovoltaicas: refresh,
        setRefreshFotovoltaicas: setRefresh,
      }}
    >
      {children}
    </FotovoltaicasContext.Provider>
  );
}
