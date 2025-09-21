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
import { useMemo } from "react";
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
  HelpCircle,
} from "lucide-react";
import { cn } from "@/core/utils";
import ShortcutsMenu from "../ShortcutsMenu";
import { Separator } from "../ui/separator";
import UpgradePlanDialog from "../UpgradePlanDialog";
import { useSidebarSlideNavigation } from "@/core/view-transitions/useGenieEffect";

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
  const isDisabled = item.comingSoon;
  const isActive =
    pathname === "/"
      ? pathname === item.url
      : pathname.includes(item.url) && item.url !== "/";
  const IconComponent = item.icon;
  const handleSidebarClick = useSidebarSlideNavigation();

  const menuButton = (
    <SidebarMenuButton
      asChild
      isActive={isActive}
      className={cn(
        "group relative h-9 justify-start transition-all duration-200",
        "rounded-md border-0",
        isActive
          ? "!bg-primary-900 !text-white"
          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
        isDisabled
          ? "opacity-40 cursor-not-allowed hover:bg-transparent hover:text-gray-600"
          : "",
        !isPlanAvailable ? "hidden" : ""
      )}
      disabled={isDisabled}
    >
      <a
        href={isDisabled ? "#" : item.url}
        className="flex items-center gap-3 w-full "
        onClick={isDisabled ? undefined : handleSidebarClick}
        data-sidebar-item={item.url}
      >
        {/* Icon */}
        <div className="flex items-center justify-center w-4 h-4 shrink-0">
          {IconComponent && <IconComponent className="w-4 h-4" />}
        </div>

        {!isCollapsed && (
          <div className="flex items-center justify-between flex-1 min-w-0">
            <span className="text-sm font-medium truncate">{item.title}</span>

            {/* Minimalist indicators */}
            <div className="flex items-center gap-1.5 ml-2">
              {item.comingSoon && (
                <div className="px-1.5 py-0.5 text-xs font-medium bg-amber-50 text-amber-600 rounded border border-amber-200">
                  Próximo
                </div>
              )}
              {!isPlanAvailable && !item.comingSoon && (
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
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
    <SidebarGroup>
      {!isCollapsed && (
        <div className="mb-2">
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
            {section.title}
          </h3>
        </div>
      )}
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
  const { userPlan, isAdmin, isElite } = useNavigationAccess();

  const menuSections = useMemo(() => getMenuSections(), []);

  return (
    <Sidebar collapsible="icon" className="header-static">
      <SidebarHeader className={cn("", open ? "p-4" : "px-0 items-center")}>
        <NavUser />
        <ShortcutsMenu open={open} />
      </SidebarHeader>

      <Separator className="max-w-64 w-full mx-auto" />

      <SidebarContent className={cn("py-4", open ? "px-4" : "px-0 ")}>
        <div className="space-y-6">
          {menuSections.map((section, index) => (
            <SidebarSectionComponent
              key={index}
              section={section}
              isAdmin={isAdmin}
              userPlan={userPlan}
              isCollapsed={!open}
            />
          ))}
        </div>
      </SidebarContent>

      <SidebarFooter
        className={cn(
          "border-t border-gray-100 ",
          open ? "p-4" : "px-0 mx-auto"
        )}
      >
        {/* Plan indicator for non-Elite admins */}
        {!isElite && isAdmin && open && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full" />
              <span className="text-xs font-medium text-gray-700">
                Plan {userPlan === "starter" ? "Starter" : "Pro"}
              </span>
            </div>
            <UpgradePlanDialog />
          </div>
        )}

        {/* Settings & Support */}
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {/* <SidebarItemComponent
                item={{
                  title: "Ajustes",
                  icon: Settings,
                  url: "/ajustes",
                  plans: ["starter", "pro", "elite"],
                }}
                userPlan={userPlan}
                isCollapsed={!open}
              /> */}
              <SidebarItemComponent
                item={{
                  title: "Soporte",
                  icon: HelpCircle,
                  url: "/soporte",
                  plans: ["starter", "pro", "elite"],
                  requiresAdmin: true,
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
