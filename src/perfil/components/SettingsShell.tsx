"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  LogOut,
  KeyRound,
  ShieldCheck,
  UserRound,
  Zap,
} from "lucide-react";
import { User } from "@/core/types";
import AvatarComponent from "@/core/components/AvatarComponent";
import { Badge } from "@/core/components/ui/badge";
import { Button } from "@/core/components/ui/button";
import { Skeleton } from "@/core/components/ui/skeleton";
import { cn } from "@/core/utils";
import { useCrmSettings } from "@/crm-settings/hooks/useCrmSettings";
import ProvidersSettings from "@/crm-settings/components/ProvidersSettings";
import AutoActivationSettings from "@/crm-settings/components/AutoActivationSettings";
import ProfileSection from "@/perfil/components/ProfileSection";
import PermissionsSection from "@/perfil/components/PermissionsSection";
import SecuritySection from "@/perfil/components/SecuritySection";
import { useSignOut } from "@/perfil/hooks/useSignOut";
import { getRoleLabel } from "@/perfil/utils";

type SectionId =
  | "perfil"
  | "seguridad"
  | "proveedores"
  | "activacion"
  | "permisos";

interface SectionItem {
  id: SectionId;
  label: string;
  icon: LucideIcon;
}

interface SectionGroup {
  label: string;
  items: SectionItem[];
}

const sectionGroups: SectionGroup[] = [
  {
    label: "Cuenta",
    items: [
      { id: "perfil", label: "Perfil", icon: UserRound },
      { id: "seguridad", label: "Seguridad", icon: ShieldCheck },
    ],
  },
  {
    label: "CRM",
    items: [
      { id: "proveedores", label: "Proveedores", icon: Building2 },
      { id: "activacion", label: "Activación automática", icon: Zap },
    ],
  },
  {
    label: "Administración",
    items: [{ id: "permisos", label: "Permisos", icon: KeyRound }],
  },
];

interface Props {
  userData: User;
  refreshUserData: () => Promise<void>;
}

export default function SettingsShell({ userData, refreshUserData }: Props) {
  const [activeSection, setActiveSection] = useState<SectionId>("perfil");
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const { settings, loading, error, saveSettings } = useCrmSettings();
  const { signOut, signingOut } = useSignOut();
  const visibleSectionGroups =
    userData.role === "admin"
      ? sectionGroups
      : sectionGroups.filter((group) => group.label !== "Administración");

  const selectSection = (id: SectionId) => {
    setActiveSection(id);
    setMobileDetailOpen(true);
  };

  const renderCrmSection = (
    section: React.ComponentType<{
      settings: typeof settings;
      saveSettings: typeof saveSettings;
    }>,
  ) => {
    if (loading && !settings) {
      return (
        <div className="space-y-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <Skeleton className="h-8 w-56 rounded-lg" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
      );
    }

    if (error && !settings) {
      return (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      );
    }

    const Section = section;
    return <Section settings={settings} saveSettings={saveSettings} />;
  };

  const content = (() => {
    switch (activeSection) {
      case "perfil":
        return (
          <ProfileSection
            userData={userData}
            refreshUserData={refreshUserData}
          />
        );
      case "seguridad":
        return (
          <SecuritySection
            userData={userData}
            refreshUserData={refreshUserData}
          />
        );
      case "proveedores":
        return renderCrmSection(ProvidersSettings);
      case "activacion":
        return renderCrmSection(AutoActivationSettings);
      case "permisos":
        return userData.role === "admin" ? (
          <PermissionsSection userData={userData} />
        ) : null;
    }
  })();

  return (
    <section className="min-h-screen bg-gray-50/60">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <header className="mb-6 space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Ajustes
          </h1>
          <p className="text-sm text-gray-500">
            Gestiona tu cuenta y la configuración del CRM.
          </p>
        </header>

        <div className="lg:grid lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start lg:gap-6">
          {/* Master: barra lateral de secciones */}
          <aside
            className={cn(
              "lg:sticky lg:top-8",
              mobileDetailOpen && "hidden lg:block",
            )}
          >
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
              {/* Cabecera de usuario */}
              <div className="flex items-center gap-3 border-b border-gray-50 px-4 py-4">
                <AvatarComponent
                  className="size-12 rounded-2xl"
                  textSize="text-lg"
                  userData={userData}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">
                    {userData.name}
                  </p>
                  <p className="truncate text-xs text-gray-500">
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

              {/* Navegación de secciones */}
              <nav className="space-y-4 px-3 py-4">
                {visibleSectionGroups.map((group) => (
                  <div key={group.label} className="space-y-1">
                    <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
                      {group.label}
                    </p>
                    {group.items.map((item) => {
                      const isActive = activeSection === item.id;
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => selectSection(item.id)}
                          aria-current={isActive ? "page" : undefined}
                          className={cn(
                            "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                            isActive
                              ? "bg-primary-50 text-primary-700"
                              : "text-gray-700 hover:bg-gray-50",
                          )}
                        >
                          <span
                            className={cn(
                              "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                              isActive
                                ? "bg-primary-600 text-white"
                                : "bg-gray-100 text-gray-500 group-hover:bg-gray-200",
                            )}
                          >
                            <Icon className="size-4" />
                          </span>
                          <span className="flex-1 truncate text-sm font-medium">
                            {item.label}
                          </span>
                          <ChevronRight
                            className={cn(
                              "size-4 shrink-0",
                              isActive ? "text-primary-400" : "text-gray-300",
                            )}
                          />
                        </button>
                      );
                    })}
                  </div>
                ))}
              </nav>

              {/* Cerrar sesión */}
              <div className="border-t border-gray-50 px-3 py-3">
                <Button
                  onClick={signOut}
                  disabled={signingOut}
                  variant="ghost"
                  className="w-full justify-start rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <LogOut className="mr-2 size-4" />
                  {signingOut ? "Cerrando sesión..." : "Cerrar sesión"}
                </Button>
              </div>
            </div>
          </aside>

          {/* Detail: contenido de la sección activa */}
          <main
            className={cn(
              "min-w-0",
              !mobileDetailOpen && "hidden lg:block",
            )}
          >
            <button
              type="button"
              onClick={() => setMobileDetailOpen(false)}
              className="mb-4 flex items-center gap-1 text-sm font-medium text-primary-600 lg:hidden"
            >
              <ChevronLeft className="size-4" />
              Ajustes
            </button>
            {content}
          </main>
        </div>
      </div>
    </section>
  );
}
