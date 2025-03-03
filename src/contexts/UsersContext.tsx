"use client";
import { createContext, useContext, useCallback, useRef } from "react";

interface UsersContextType {
  refreshUsers: () => void;
  setRefreshUsers: (callback: () => void) => () => void;
}

const UsersContext = createContext<UsersContextType>({
  refreshUsers: () => {},
  setRefreshUsers: () => () => {},
});

export const useUsers = () => useContext(UsersContext);

export function UsersProvider({ children }: { children: React.ReactNode }) {
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
    <UsersContext.Provider
      value={{ refreshUsers: refresh, setRefreshUsers: setRefresh }}
    >
      {children}
    </UsersContext.Provider>
  );
}
