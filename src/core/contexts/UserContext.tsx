"use client";

import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { User } from "@/core/types";
import { authClient } from "@/core/auth/auth-client";
import FullScreenLoaderComponent from "@/core/components/FullScreenLoaderComponent";
import { ReauthModal } from "@/core/components/ReauthModal";
interface UserContextType {
  userData: User | null; // Cambiamos el tipo para manejar explícitamente el caso nulo
  loading: boolean;
  refreshUserData: () => Promise<void>;
  getPlan: () => string | null; // New function to get organization plan
  showReauthModal: boolean;
  setShowReauthModal: (show: boolean) => void;
}

const PUBLIC_PATHS = ["/login"];

const isPublicPath = (pathname: string | null) => {
  if (!pathname) return false;
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReauthModal, setShowReauthModal] = useState(false);
  const { data: session, isPending: isSessionPending } =
    authClient.useSession();
  const router = useRouter();
  const pathname = usePathname();
  const userID = session?.user.id;
  const expiredAt = session?.session.expiresAt;

  const refreshUserData = useCallback(async () => {
    if (!userID) {
      setUserData(null);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/v2/users/${userID}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      // Check if the response indicates session expiration
      if (res.status === 401) {
        setShowReauthModal(true);
        setUserData(null);
        setLoading(false);
        return;
      }

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

  const getPlan = useCallback(() => {
    if (!userData || !userData.organization) {
      return null;
    }
    return userData.organization.plan || null;
  }, [userData]);

  const handleReauthSuccess = useCallback(async () => {
    setShowReauthModal(false);
    await refreshUserData();
  }, [refreshUserData]);

  // Esperar a que better-auth resuelva la sesión antes de actuar
  useEffect(() => {
    if (isSessionPending) {
      return;
    }

    // Sin sesión válida: limpiar estado y redirigir a /login
    // si estamos en una ruta protegida. Esto cubre el caso en que la cookie
    // existe (pasa el middleware) pero el servidor ya no reconoce la sesión.
    if (!userID) {
      setUserData(null);
      setLoading(false);
      if (!isPublicPath(pathname)) {
        router.replace("/login");
      }
      return;
    }

    refreshUserData();
  }, [isSessionPending, userID, pathname, router, refreshUserData]);

  // Check session expiration periodically
  useEffect(() => {
    if (!expiredAt || !session) return;

    const checkSessionExpiration = () => {
      const isExpired = new Date(expiredAt) < new Date();
      if (isExpired && !showReauthModal && userData) {
        setShowReauthModal(true);
      }
    };

    // Check immediately
    checkSessionExpiration();

    // Check every 30 seconds
    const interval = setInterval(checkSessionExpiration, 30000);

    return () => clearInterval(interval);
  }, [expiredAt, session, showReauthModal, userData]);

  // Mostrar loader mientras:
  // - better-auth está resolviendo la sesión
  // - o estamos cargando los datos del usuario en una ruta protegida
  // En rutas públicas (login) no bloqueamos el render.
  if ((isSessionPending || loading) && !isPublicPath(pathname)) {
    return <FullScreenLoaderComponent />;
  }

  return (
    <UserContext.Provider
      value={{
        userData,
        loading,
        refreshUserData,
        getPlan,
        showReauthModal,
        setShowReauthModal,
      }}
    >
      {children}
      {showReauthModal && userData?.email && (
        <ReauthModal
          isOpen={showReauthModal}
          onSuccess={handleReauthSuccess}
          userEmail={userData.email}
        />
      )}
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
