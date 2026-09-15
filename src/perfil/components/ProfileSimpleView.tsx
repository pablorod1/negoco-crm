"use client";

import { User } from "@/core/types";
import AvatarComponent from "@/core/components/AvatarComponent";
import { Badge } from "@/core/components/ui/badge";
import { Button } from "@/core/components/ui/button";
import ProfileSection from "@/perfil/components/ProfileSection";
import SecuritySection from "@/perfil/components/SecuritySection";
import { useSignOut } from "@/perfil/hooks/useSignOut";
import { getRoleLabel } from "@/perfil/utils";
import { LogOut } from "lucide-react";

interface Props {
  userData: User;
  refreshUserData: () => Promise<void>;
}

export default function ProfileSimpleView({ userData, refreshUserData }: Props) {
  const { signOut, signingOut } = useSignOut();

  return (
    <section className="min-h-screen bg-gray-50/60">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Mi perfil
          </h1>
          <p className="text-sm text-gray-500">
            Gestiona tu información personal y la seguridad de tu cuenta.
          </p>
        </header>

        {/* Tarjeta de cuenta */}
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <AvatarComponent
                className="size-14 rounded-2xl"
                textSize="text-xl"
                userData={userData}
              />
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-gray-900">
                  {userData.name}
                </p>
                <p className="truncate text-sm text-gray-500">
                  {userData.email}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary" className="px-2 py-0">
                    {getRoleLabel(userData.role)}
                  </Badge>
                  {userData.organization?.name && (
                    <span className="truncate text-xs text-gray-400">
                      {userData.organization.name}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <Button
              onClick={signOut}
              disabled={signingOut}
              variant="outline"
              size="sm"
              className="rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <LogOut className="mr-2 size-4" />
              {signingOut ? "Cerrando sesión..." : "Cerrar sesión"}
            </Button>
          </div>
        </div>

        <ProfileSection userData={userData} refreshUserData={refreshUserData} />
        <SecuritySection userData={userData} refreshUserData={refreshUserData} />
      </div>
    </section>
  );
}
