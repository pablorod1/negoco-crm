"use client";

import { useUser } from "@/core/contexts/UserContext";
import FullScreenLoaderComponent from "@/core/components/FullScreenLoaderComponent";
import SettingsShell from "@/perfil/components/SettingsShell";
import ProfileSimpleView from "@/perfil/components/ProfileSimpleView";
import { isAdminRole } from "@/perfil/utils";

export default function AccountSettings() {
  const { userData, refreshUserData, loading } = useUser();

  if (loading || !userData) {
    return <FullScreenLoaderComponent />;
  }

  return isAdminRole(userData.role) ? (
    <SettingsShell userData={userData} refreshUserData={refreshUserData} />
  ) : (
    <ProfileSimpleView userData={userData} refreshUserData={refreshUserData} />
  );
}
