"use client";
import { createContext, useContext, useCallback, useRef } from "react";

interface TramitesContextType {
  refreshTramites: () => void;
  setRefreshTramites: (callback: () => void) => () => void;
}

const TramitesContext = createContext<TramitesContextType>({
  refreshTramites: () => {},
  setRefreshTramites: () => () => {},
});

export const useTramites = () => useContext(TramitesContext);

export function TramitesProvider({ children }: { children: React.ReactNode }) {
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
    <TramitesContext.Provider
      value={{ refreshTramites: refresh, setRefreshTramites: setRefresh }}
    >
      {children}
    </TramitesContext.Provider>
  );
}
