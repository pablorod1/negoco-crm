"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/core/components/ui/sidebar";
import Image from "next/image";
import { Link } from "next-view-transitions";
import NavUser from "./NavUser";
import { usePathname } from "next/navigation";
import { useUser } from "@/core/contexts/UserContext";
import TooltipComponent from "../TooltipComponent";
import { useMemo } from "react";
import { Badge } from "@/core/components/ui/badge";

// Types
type PlanType = "starter" | "pro" | "elite";

interface SidebarMenuItem {
  title: string;
  url: string;
  icon?: string;
  description?: string;
  requiresAdmin?: boolean;
  comingSoon?: boolean;
  plans: PlanType[];
}

interface SidebarSection {
  title: string;
  items: SidebarMenuItem[];
}

const DEFAULT_LOGO_COLLAPSED = "/logo_inline.png";
const DEFAULT_LOGO = "/logo_inline.png";

// Custom hooks
const useNavigationAccess = () => {
  const { userData, getPlan } = useUser();

  return useMemo(() => {
    const userPlan = getPlan() as PlanType;
    const isAdmin = userData?.role === "admin" || userData?.role === "1";
    const isElite = userPlan === "elite";

    return { userPlan, isAdmin, isElite };
  }, [userData?.role, getPlan]);
};

// Menu configuration
const getMenuSections = (): SidebarSection[] => [
  {
    title: "Principal",
    items: [
      {
        title: "Dashboard",
        url: "/",
        icon: "/icons/dashboard.webp",
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
        icon: "/icons/comparativas2.webp",
        description: "Solicita tu comparativa energética",
        plans: ["pro", "elite"],
      },
      {
        title: "Trámites",
        url: "/tramites",
        icon: "/icons/tramite.webp",
        description: "Gestión de trámites y seguimiento",
        plans: ["starter", "pro", "elite"],
      },
      {
        title: "Fotovoltaica",
        url: "/fotovoltaica",
        icon: "/icons/liquidez.webp",
        description: "Solicita tu estudio fotovoltaico",
        plans: ["pro", "elite"],
      },
      {
        title: "Liquidaciones",
        url: "/liquidez",
        icon: "/icons/liquidez.webp",
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
        icon: "/icons/equipo.webp",
        description: "Gestión y seguimiento de clientes",
        plans: ["starter", "pro", "elite"],
      },
      {
        title: "Comercializadoras",
        url: "/comercializadoras",
        icon: "/icons/equipo.webp",
        description: "Gestión de proveedores energéticos",
        plans: ["starter", "pro", "elite"],
      },
      {
        title: "Documentación",
        url: "/documentacion",
        icon: "/file-icons/folder.png",
        description: "Archivos y documentos asociados",
        plans: ["starter", "pro", "elite"],
      },
      {
        title: "Colaboradores",
        url: "/colaboradores",
        icon: "/icons/equipo.webp",
        description: "Control de usuarios y colaboradores",
        plans: ["starter", "pro", "elite"],
      },
      {
        title: "Difusiones",
        url: "/difusiones",
        icon: "/icons/equipo.webp",
        description: "Comunicaciones y campañas informativas",
        requiresAdmin: true,
        comingSoon: true,
        plans: ["pro", "elite"],
      },
    ],
  },
];

// Menu Item Component
const SidebarMenuItemComponent: React.FC<{
  item: SidebarMenuItem;
  userPlan: PlanType;
  isCollapsed: boolean;
}> = ({ item, userPlan, isCollapsed }) => {
  const pathname = usePathname();
  const isPlanAvailable = !item.plans || item.plans.includes(userPlan);
  const isDisabled = item.comingSoon || !isPlanAvailable;
  const isActive = pathname === item.url;

  const menuButton = (
    <SidebarMenuButton
      asChild
      isActive={isActive}
      className={`
        group relative h-11 justify-start transition-all duration-200
        ${
          isActive
            ? "bg-primary text-primary-foreground shadow-sm"
            : "hover:bg-accent hover:text-accent-foreground"
        }
        ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}
      `}
      disabled={isDisabled}
    >
      <Link
        href={isDisabled ? "#" : item.url}
        className="flex items-center gap-3 w-full"
        onClick={(e) => isDisabled && e.preventDefault()}
      >
        {/* Icon placeholder */}
        <div className="flex items-center justify-center w-5 h-5 rounded-sm bg-current/10">
          <div className="w-3 h-3 rounded-sm bg-current/60" />
        </div>

        <div className="flex flex-col items-start flex-1 min-w-0">
          <div className="flex items-center gap-2 w-full">
            <span className="text-sm font-medium truncate">{item.title}</span>
            {item.comingSoon && !isCollapsed && (
              <Badge
                variant="secondary"
                className="text-xs px-1.5 py-0.5 h-auto"
              >
                Próximamente
              </Badge>
            )}
            {!isPlanAvailable && !item.comingSoon && !isCollapsed && (
              <Badge variant="outline" className="text-xs px-1.5 py-0.5 h-auto">
                Plan superior
              </Badge>
            )}
          </div>
          {item.description && !isCollapsed && (
            <span className="text-xs text-muted-foreground truncate w-full">
              {item.description}
            </span>
          )}
        </div>
      </Link>
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

// Section Component
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
        <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">
          {section.title}
        </SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu className="gap-1">
          {visibleItems.map((item) => (
            <SidebarMenuItemComponent
              key={item.url}
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
  const { userData } = useUser();
  const { open } = useSidebar();
  const { userPlan, isAdmin } = useNavigationAccess();

  // Obtener el logo de forma segura
  const organizationLogo = userData?.organization?.logo;
  const menuSections = useMemo(() => getMenuSections(), []);

  return (
    <Sidebar variant="floating" collapsible="icon">
      <SidebarHeader className="border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3 transition-all">
            {organizationLogo ? (
              <>
                <div className="flex-shrink-0">
                  <Image
                    src={organizationLogo}
                    alt="Logo"
                    width={32}
                    height={32}
                    priority
                    className="w-8 h-8 rounded-md"
                  />
                </div>
                {open && (
                  <div className="flex flex-col min-w-0">
                    <h2 className="text-lg font-bold text-primary truncate">
                      {userData?.organization?.name}
                    </h2>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex-shrink-0">
                  <Image
                    src={DEFAULT_LOGO_COLLAPSED}
                    alt="Logo"
                    width={32}
                    height={32}
                    priority
                    className="w-8 h-8"
                  />
                </div>
                {open && (
                  <Image
                    src={DEFAULT_LOGO}
                    alt="Logo"
                    width={140}
                    height={32}
                    priority
                    className="h-8 w-auto"
                  />
                )}
              </>
            )}
          </Link>
        </div>

        <div className="flex justify-end mt-2">
          <SidebarTrigger className="h-8 w-8" />
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 py-4">
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

      <SidebarFooter className="border-t px-3 py-4">
        {/* Plan indicator */}
        {!open ? (
          <TooltipComponent placement="right" content={`Plan ${userPlan}`}>
            <div className="flex justify-center">
              <div className="w-2 h-2 rounded-full bg-green-500" />
            </div>
          </TooltipComponent>
        ) : (
          <div className="px-3 py-2 rounded-lg bg-muted/50 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs font-medium capitalize text-muted-foreground">
                Plan {userPlan}
              </span>
            </div>
          </div>
        )}

        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
