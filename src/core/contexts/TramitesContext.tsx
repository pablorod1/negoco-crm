"use client";
import { createContext, useContext, useCallback, useRef } from "react";

interface TramitesContextType {
  refreshTramites: () => Promise<void>;
  setRefreshTramites: (callback: () => Promise<void>) => () => void;
}

const TramitesContext = createContext<TramitesContextType>({
  refreshTramites: async () => {},
  setRefreshTramites: () => () => {},
});

export const useTramites = () => useContext(TramitesContext);

export function TramitesProvider({ children }: { children: React.ReactNode }) {
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
    <TramitesContext.Provider
      value={{ refreshTramites: refresh, setRefreshTramites: setRefresh }}
    >
      {children}
    </TramitesContext.Provider>
  );
}

