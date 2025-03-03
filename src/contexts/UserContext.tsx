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
import { getUserById } from "@/lib/libsql/data/colaboradores/getUsers";
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
      const fetchedData = await getUserById(userID);
      setUserData(fetchedData || null);
    } catch (error) {
      console.error("Error fetching user data:", error);
      setUserData(null);
    } finally {
      setTimeout(() => setLoading(false), 400);
    }
  }, [userID]);

  useEffect(() => {
    refreshUserData();
  }, [refreshUserData]);

  if (loading || !userData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner
          label="Cargando..."
          color="primary"
          size="lg"
          className="text-xl"
        />
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
