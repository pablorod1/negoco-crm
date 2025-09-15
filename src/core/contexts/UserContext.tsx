"use client";

import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useState,
} from "react";
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

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReauthModal, setShowReauthModal] = useState(false);
  const { data: session } = authClient.useSession();
  const userID = session?.user.id;
  const expiredAt = session?.session.expiresAt;

  const refreshUserData = useCallback(async () => {
    if (!userID) {
      setUserData(null);
      setTimeout(() => setLoading(false), 400);
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
      console.log("Fetched user data:", data);
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

  useEffect(() => {
    refreshUserData();
  }, [refreshUserData]);

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

  if (loading) {
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
