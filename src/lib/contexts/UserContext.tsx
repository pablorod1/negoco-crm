"use client";

import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useState,
} from "react";
import { Spinner } from "@heroui/spinner";
import { User } from "@/lib/core/types";
import { authClient } from "@/lib/auth/auth-client";

interface UserContextType {
  userData: User | null; // Cambiamos el tipo para manejar explícitamente el caso nulo
  loading: boolean;
  refreshUserData: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { data: session } = authClient.useSession();
  const userID = session?.user.id;

  const refreshUserData = useCallback(async () => {
    if (!userID) {
      setUserData(null);
      setTimeout(() => setLoading(false), 400);
      return;
    }

    try {
      const res = await fetch(`/api/users/get/user-by-id`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: userID }),
      });
      const { success, data, error } = await res.json();
      if (!success) {
        throw new Error(error || "Error fetching user data");
      }

      setUserData(data || null);
    } catch (error) {
      console.error("Error fetching user data:", error);
      setUserData(null);
    } finally {
      setLoading(false);
    }
  }, [userID]);

  useEffect(() => {
    refreshUserData();
  }, [refreshUserData]);

  if (loading || !userData) {
    return (
      <div className="min-h-screen flex flex-col gap-4 items-center justify-center">
        <Spinner variant="gradient" color="primary" size="lg" />
        <div className="flex flex-col items-center text-center">
          <span className="text-xl font-bold">Cargando...</span>
          <span className="mt-2 text-gray-600 text-sm">
            Espera mientras cargamos todos los datos
          </span>
        </div>
      </div>
    );
  }

  return (
    <UserContext.Provider value={{ userData, loading, refreshUserData }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);

  if (context === undefined) {
    throw new Error("useUser debe usarse dentro de UserProvider");
  }

  return context;
}
