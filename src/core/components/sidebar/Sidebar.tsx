"use client";

import React from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/core/components/ui/sidebar";
import NavUser from "./NavUser";
import { usePathname } from "next/navigation";
import { useUser } from "@/core/contexts/UserContext";
import TooltipComponent from "../TooltipComponent";
import { useMemo, useState, useEffect } from "react";
import { Badge } from "@/core/components/ui/badge";
import {
  LayoutDashboard,
  BarChart3,
  FileText,
  Sun,
  DollarSign,
  Users,
  Building2,
  FolderOpen,
  UserCheck,
  Megaphone,
  Zap,
  BadgeCheck,
  Settings,
  HelpCircle,
  X,
} from "lucide-react";
import { cn } from "@/core/utils";
import ShortcutsMenu from "../ShortcutsMenu";
import { Separator } from "../ui/separator";
import UpgradePlanDialog from "../UpgradePlanDialog";
import { useSidebarGenieNavigation } from "@/core/view-transitions/useGenieEffect";

// Types
type PlanType = "starter" | "pro" | "elite";

interface SidebarItem {
  title: string;
  url: string;
  icon?: React.ComponentType<{ className?: string }>;
  description?: string;
  requiresAdmin?: boolean;
  comingSoon?: boolean;
  plans: PlanType[];
}

interface SidebarSection {
  title: string;
  items: SidebarItem[];
}

// Custom hooks
const useNavigationAccess = () => {
  const { userData, getPlan } = useUser();

  return useMemo(() => {
    const userPlan = getPlan() as PlanType;
    const isAdmin = userData?.role === "admin" || userData?.role === "1";
    const isElite = userPlan === "elite";
    const isPro = userPlan === "pro";
    const isStarter = userPlan === "starter";

    return { userPlan, isAdmin, isElite, isPro, isStarter };
  }, [userData?.role, getPlan]);
};

// Helper para manejar el localStorage del mensaje del plan
const usePlanMessageVisibility = (userPlan: PlanType) => {
  const [isMessageVisible, setIsMessageVisible] = useState(true);

  useEffect(() => {
    const storageKey = `plan-message-hidden-${userPlan}`;
    const stored = localStorage.getItem(storageKey);

    if (stored) {
      try {
        const { hiddenUntil } = JSON.parse(stored);
        const now = new Date();
        const expirationDate = new Date(hiddenUntil);

        // Si la fecha de expiración no ha pasado, ocultar el mensaje
        if (now < expirationDate) {
          setIsMessageVisible(false);
        } else {
          // Si la fecha ha pasado, limpiar el localStorage
          localStorage.removeItem(storageKey);
        }
      } catch {
        // Si hay error parseando, limpiar el localStorage
        localStorage.removeItem(storageKey);
      }
    }
  }, [userPlan]);

  const hideMessage = () => {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const storageKey = `plan-message-hidden-${userPlan}`;
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        hiddenUntil: nextMonth.toISOString(),
      })
    );

    setIsMessageVisible(false);
  };

  return { isMessageVisible, hideMessage };
};

const getMenuSections = (): SidebarSection[] => [
  {
    title: "Principal",
    items: [
      {
        title: "Dashboard",
        url: "/",
        icon: LayoutDashboard,
        plans: ["starter", "pro", "elite"],
      },
    ],
  },
  {
    title: "Operaciones",
    items: [
      {
        title: "Comparativas",
        url: "/comparativas",
        icon: BarChart3,
        description: "Solicita tu comparativa energética",
        plans: ["pro", "elite"],
      },
      {
        title: "Trámites",
        url: "/tramites",
        icon: FileText,
        description: "Gestión de trámites y seguimiento",
        plans: ["starter", "pro", "elite"],
      },
      {
        title: "Fotovoltaica",
        url: "/fotovoltaica",
        icon: Sun,
        description: "Solicita tu estudio fotovoltaico",
        plans: ["pro", "elite"],
      },
      {
        title: "Liquidaciones",
        url: "/liquidez",
        icon: DollarSign,
        description: "Registro y control de liquidaciones",
        requiresAdmin: true,
        plans: ["starter", "pro", "elite"],
      },
    ],
  },
  {
    title: "Gestión",
    items: [
      {
        title: "Clientes",
        url: "/clientes",
        icon: Users,
        description: "Gestión y seguimiento de clientes",
        plans: ["starter", "pro", "elite"],
      },
      {
        title: "Comercializadoras",
        url: "/comercializadoras",
        icon: Building2,
        description: "Gestión de proveedores energéticos",
        plans: ["starter", "pro", "elite"],
      },
      {
        title: "Documentación",
        url: "/documentacion",
        icon: FolderOpen,
        description: "Archivos y documentos asociados",
        plans: ["starter", "pro", "elite"],
      },
      {
        title: "Colaboradores",
        url: "/colaboradores",
        icon: UserCheck,
        description: "Control de usuarios y colaboradores",
        plans: ["starter", "pro", "elite"],
      },
      {
        title: "Difusiones",
        url: "/difusiones",
        icon: Megaphone,
        description: "Comunicaciones y campañas informativas",
        requiresAdmin: true,
        comingSoon: true,
        plans: ["pro", "elite"],
      },
    ],
  },
];

const SidebarItemComponent: React.FC<{
  item: SidebarItem;
  userPlan: PlanType;
  isCollapsed: boolean;
}> = ({ item, userPlan, isCollapsed }) => {
  const pathname = usePathname();
  const isPlanAvailable = !item.plans || item.plans.includes(userPlan);
  const isDisabled = item.comingSoon || !isPlanAvailable;
  const isActive = pathname === item.url;
  const IconComponent = item.icon;
  const handleSidebarClick = useSidebarGenieNavigation();

  const menuButton = (
    <SidebarMenuButton
      asChild
      isActive={isActive}
      className={cn(
        "group relative h-10 justify-start transition-all duration-200",
        "border border-transparent rounded-lg",
        isActive
          ? "!bg-primary-900 !text-white shadow-sm"
          : "hover:bg-slate-100 text-slate-700 hover:text-slate-900",
        isDisabled ? "opacity-50 cursor-not-allowed hover:bg-transparent" : ""
      )}
      disabled={isDisabled}
    >
      <a
        href={isDisabled ? "#" : item.url}
        className="flex items-center gap-3 w-full px-3"
        onClick={isDisabled ? undefined : handleSidebarClick}
        data-sidebar-item={item.url}
      >
        {/* Simple icon */}
        <div className="flex items-center justify-center w-5 h-5">
          {IconComponent && <IconComponent className="w-4 h-4" />}
        </div>

        {!isCollapsed && (
          <div className="flex items-center justify-between flex-1 min-w-0">
            <span className="text-sm font-medium truncate">{item.title}</span>

            {/* Compact badges */}
            <div className="flex items-center gap-1 ml-2">
              {item.comingSoon && (
                <Badge
                  variant="secondary"
                  className="text-xs px-1.5 py-0 h-5 bg-amber-100 text-amber-700 border-amber-200"
                >
                  Próximo
                </Badge>
              )}
              {!isPlanAvailable && !item.comingSoon && (
                <Badge
                  variant="outline"
                  className="text-xs px-1.5 py-0 h-5 bg-blue-50 text-blue-600 border-blue-200"
                >
                  Pro
                </Badge>
              )}
            </div>
          </div>
        )}
        {isActive && !isCollapsed ? (
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-white rounded-full" />
        ) : null}
      </a>
    </SidebarMenuButton>
  );

  if (isCollapsed) {
    return (
      <SidebarMenuItem>
        <TooltipComponent placement="right" content={item.title}>
          {menuButton}
        </TooltipComponent>
      </SidebarMenuItem>
    );
  }

  return <SidebarMenuItem>{menuButton}</SidebarMenuItem>;
};

const SidebarSectionComponent: React.FC<{
  section: SidebarSection;
  isAdmin: boolean;
  userPlan: PlanType;
  isCollapsed: boolean;
}> = ({ section, isAdmin, userPlan, isCollapsed }) => {
  const visibleItems = section.items.filter(
    (item) => !item.requiresAdmin || isAdmin
  );

  if (visibleItems.length === 0) return null;

  return (
    <SidebarGroup className="px-2">
      <SidebarGroupContent>
        <SidebarMenu className="gap-1">
          {visibleItems.map((item, index) => (
            <SidebarItemComponent
              key={index}
              item={item}
              userPlan={userPlan}
              isCollapsed={isCollapsed}
            />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
};

export function SidebarComponent() {
  const { open } = useSidebar();
  const { userPlan, isAdmin, isElite, isStarter, isPro } =
    useNavigationAccess();
  const { isMessageVisible, hideMessage } = usePlanMessageVisibility(userPlan);

  const menuSections = useMemo(() => getMenuSections(), []);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader
        className={cn(
          "space-y-6 mt-2",
          open ? "p-2" : "p-1.5",
          "transition-all duration-300"
        )}
      >
        <NavUser />
        <ShortcutsMenu open={open} />
      </SidebarHeader>

      <Separator className="max-w-60 mx-auto  rounded-full " />

      <SidebarContent className="py-2 flex flex-col justify-between h-full">
        <div className="space-y-2">
          {menuSections.map((section, index) => (
            <React.Fragment key={`fragment-${index}`}>
              <SidebarSectionComponent
                key={index}
                section={section}
                isAdmin={isAdmin}
                userPlan={userPlan}
                isCollapsed={!open}
              />
              <Separator className="max-w-60 mx-auto rounded-full" />
            </React.Fragment>
          ))}
        </div>
      </SidebarContent>

      <SidebarFooter className="border-t border-slate-200/60 bg-slate-50/50">
        {!isElite && isAdmin && isMessageVisible ? (
          <div className="relative rounded-xl bg-gradient-to-b from-white to-primary-50 p-4 flex flex-col justify-between gap-4 shadow-sm">
            {/* Botón de cerrar */}
            <button
              onClick={hideMessage}
              className="absolute top-2 right-2 p-1 rounded-full hover:bg-slate-200/50 transition-colors"
              aria-label="Cerrar mensaje"
            >
              <X className="w-3 h-3 text-slate-400 hover:text-slate-600" />
            </button>

            {/* Texto personalizado según el plan */}
            <div className="flex flex-col gap-3 pr-6">
              {isStarter ? (
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Zap className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-semibold text-slate-700">
                      Plan Starter
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Mejora a <strong>Pro</strong> para acceder a comparativas
                    energéticas y fotovoltaica, además de soporte por WhatsApp y
                    más usuarios.
                  </p>
                </div>
              ) : isPro ? (
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <BadgeCheck className="w-4 h-4 text-purple-600" />
                    <span className="text-sm font-semibold text-slate-700">
                      Plan Pro
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Actualiza a <strong>Élite</strong> para personalización
                    completa con tu logo, colores corporativos, soporte
                    prioritario y usuarios ilimitados.
                  </p>
                </div>
              ) : null}
            </div>

            {/* Botón de upgrade solo para admins no-Elite */}
            <div className="flex flex-col items-start">
              <UpgradePlanDialog />
            </div>
          </div>
        ) : null}

        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              <SidebarItemComponent
                item={{
                  title: "Ajustes",
                  icon: Settings,
                  url: "/ajustes",
                  plans: ["starter", "pro", "elite"],
                }}
                userPlan={userPlan}
                isCollapsed={!open}
              />
              <SidebarItemComponent
                item={{
                  title: "Soporte",
                  icon: HelpCircle,
                  url: "/soporte",
                  plans: ["starter", "pro", "elite"],
                }}
                userPlan={userPlan}
                isCollapsed={!open}
              />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarFooter>
    </Sidebar>
  );
}
