"use client";

import { User } from "@/core/types";
import UpdatePassword from "@/perfil/components/UpdatePassword";
import SettingsCard from "@/perfil/components/SettingsCard";
import { ShieldCheck } from "lucide-react";

interface Props {
  userData: User;
  refreshUserData: () => Promise<void>;
}

export default function SecuritySection({ userData, refreshUserData }: Props) {
  return (
    <SettingsCard
      title="Seguridad"
      description="Mantén tu cuenta protegida con una contraseña robusta."
      icon={<ShieldCheck className="size-5" />}
    >
      <UpdatePassword userData={userData} refreshUserData={refreshUserData} />
    </SettingsCard>
  );
}
