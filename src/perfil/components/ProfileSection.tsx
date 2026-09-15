"use client";

import { User } from "@/core/types";
import UploadAvatar from "@/perfil/components/UploadAvatar";
import UpdateUser from "@/perfil/components/UpdateUser";
import SettingsCard from "@/perfil/components/SettingsCard";
import { UserRound } from "lucide-react";

interface Props {
  userData: User;
  refreshUserData: () => Promise<void>;
}

export default function ProfileSection({ userData, refreshUserData }: Props) {
  return (
    <SettingsCard
      title="Información del perfil"
      description="Actualiza tu foto y tus datos personales."
      icon={<UserRound className="size-5" />}
      bodyClassName="space-y-8"
    >
      <UploadAvatar userData={userData} refreshUserData={refreshUserData} />
      <div className="border-t border-gray-100 pt-8">
        <UpdateUser userData={userData} refreshUserData={refreshUserData} />
      </div>
    </SettingsCard>
  );
}
