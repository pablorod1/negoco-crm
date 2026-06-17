"use client";

import { useUser } from "@/core/contexts/UserContext";
import { isAdminRole } from "@/perfil/utils";
import { Skeleton } from "@/core/components/ui/skeleton";
import DashboardAnnouncementConfigPanel from "@/dashboard-announcements/components/DashboardAnnouncementConfigPanel";
import { ShieldAlert } from "lucide-react";

export default function DifusionesPage() {
  const { userData, loading } = useUser();
  const isAdmin = userData ? isAdminRole(userData.role) : false;

  return (
    <div className="w-full">
      <header className="border-b border-gray-100 bg-white">
        <div className="container mx-auto space-y-1 px-6 py-6">
          <h1 className="text-2xl font-semibold text-gray-900">Difusiones</h1>
          <p className="text-sm text-gray-500">
            Publica el cartel destacado que verán todos los usuarios al entrar
            en su dashboard.
          </p>
        </div>
      </header>

      <div className="container mx-auto px-6 py-6">
        {loading || !userData ? (
          <Skeleton className="h-64 w-full rounded-2xl" />
        ) : isAdmin ? (
          <DashboardAnnouncementConfigPanel />
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
              <ShieldAlert className="size-6" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-semibold text-gray-900">
                Acceso restringido
              </p>
              <p className="max-w-sm text-sm text-gray-500">
                Solo el equipo de dirección puede gestionar las difusiones del
                dashboard.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
