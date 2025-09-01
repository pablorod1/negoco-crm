"use client";

import React, { useMemo } from "react";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/core/components/ui/navigation-menu";
import { useUser } from "@/core/contexts/UserContext";
import { cn } from "@/core/utils";
import {
  BarChart3,
  FileText,
  Users,
  FolderOpen,
  ArrowRightLeft,
  ClipboardList,
  Wallet,
  Home,
  Factory,
  BookUser,
  Megaphone,
  Sun,
} from "lucide-react";
import Image from "next/image";
import { Link, useTransitionRouter } from "next-view-transitions";
import UpgradePlanDialog from "./UpgradePlanDialog";
import { slideInOut } from "../view-transitions/view-transitions";

// Types
type PlanType = "starter" | "pro" | "elite";

interface MenuItem {
  href: string;
  title: string;
  icon: React.ReactNode;
  description: string;
  requiresAdmin?: boolean;
  comingSoon?: boolean;
  plans: PlanType[];
}

interface MenuSection {
  title: string;
  icon: React.ReactNode;
  subtitle: string;
  description: string;
  columns: MenuItem[][];
}

interface NavigationMenuProps {
  activeOrganization: string;
  className?: string;
}

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

// Banner Component
const MenuBanner: React.FC<{
  activeOrganization: string;
  title: string;
  description: string;
  showUpgrade?: boolean;
}> = ({ activeOrganization, title, description, showUpgrade = false }) => {
  const logoSrc =
    activeOrganization === "beenergy" ? "/beenergy.png" : "/logo_inline.png";

  return (
    <div className="relative rounded-xl bg-gradient-to-b from-white to-primary-50 p-4 flex flex-col justify-between gap-8 shadow-sm">
      <div className="flex flex-col items-start">
        <Image
          src={logoSrc}
          alt={`${activeOrganization} Logo`}
          width={200}
          height={200}
          className="w-48 h-auto"
        />
        {showUpgrade && <UpgradePlanDialog />}
      </div>
      <div>
        <h4 className="text-sm font-semibold text-primary mb-2">{title}</h4>
        <p className="text-xs text-muted-foreground leading-snug">
          {description}
        </p>
      </div>
    </div>
  );
};

// Menu Item Component
const MenuItemComponent: React.FC<{
  item: MenuItem;
  userPlan: PlanType;
}> = ({ item, userPlan }) => {
  const isPlanAvailable = !item.plans || item.plans.includes(userPlan);
  const isDisabled = item.comingSoon || !isPlanAvailable;
  const router = useTransitionRouter();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    router.push(item.href, {
      onTransitionReady: slideInOut,
    });
  };

  return (
    <li>
      <NavigationMenuLink asChild>
        <a
          href={item.href}
          onClick={handleClick}
          className={cn(
            "flex items-start gap-3 select-none rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
            isDisabled && "opacity-70 cursor-not-allowed pointer-events-none"
          )}
          aria-label={`Ir a ${item.title}`}
          tabIndex={isDisabled ? -1 : undefined}
        >
          {item.icon && (
            <div className="flex-shrink-0 mt-0.5" aria-hidden="true">
              {item.icon}
            </div>
          )}
          <div className="space-y-1">
            <div className="text-sm font-medium leading-none flex items-center gap-2">
              {item.title}
              {item.comingSoon && (
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  Próximamente
                </span>
              )}
              {!isPlanAvailable && !item.comingSoon && (
                <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                  Plan superior
                </span>
              )}
            </div>
            <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">
              {item.description}
            </p>
          </div>
        </a>
      </NavigationMenuLink>
    </li>
  );
};

// Menu Section Component
const MenuSectionComponent: React.FC<{
  section: MenuSection;
  isAdmin: boolean;
  userPlan: PlanType;
  activeOrganization: string;
  showUpgrade: boolean;
}> = ({ section, isAdmin, userPlan, activeOrganization, showUpgrade }) => {
  const gridColumns =
    section.columns.length === 1
      ? "md:w-[600px] lg:w-[700px] grid-cols-1 lg:grid-cols-[0.8fr_1.2fr]"
      : "md:w-[700px] lg:w-[900px] grid-cols-1 lg:grid-cols-[1fr_1fr_1fr]";

  return (
    <NavigationMenuItem>
      <NavigationMenuTrigger
        className="bg-white hover:bg-primary-50 transition-all"
        aria-label={`Abrir menú de ${section.title}`}
      >
        {section.icon}
        {section.title}
      </NavigationMenuTrigger>
      <NavigationMenuContent>
        <div className={cn("grid gap-4 bg-card rounded-xl p-4", gridColumns)}>
          <MenuBanner
            activeOrganization={activeOrganization}
            title={section.subtitle}
            description={section.description}
            showUpgrade={showUpgrade}
          />

          {section.columns.map((column, index) => (
            <ul key={index} className="flex flex-col gap-3">
              {column.map((item, itemIndex) => {
                const shouldShowItem = !item.requiresAdmin || isAdmin;

                if (!shouldShowItem) return null;

                return (
                  <MenuItemComponent
                    key={itemIndex}
                    item={item}
                    userPlan={userPlan}
                  />
                );
              })}
            </ul>
          ))}
        </div>
      </NavigationMenuContent>
    </NavigationMenuItem>
  );
};

// Menu Configuration
const getMenuSections = (): MenuSection[] => [
  {
    title: "Operaciones",
    icon: <BarChart3 className="w-4 h-4 mr-2" />,
    subtitle: "Gestiona tus operaciones",
    description:
      "Accede a la información de tus operaciones y gestiona trámites, liquidaciones y comparativas de tarifas.",
    columns: [
      [
        {
          href: "/comparativas",
          title: "Comparativas",
          icon: <ArrowRightLeft className="w-5 h-5 text-primary" />,
          description: "Solicita tu comparativa energética.",
          plans: ["pro", "elite"],
        },
        {
          href: "/tramites",
          title: "Trámites",
          icon: <ClipboardList className="w-5 h-5 text-primary" />,
          description: "Gestión de trámites y seguimiento.",
          plans: ["starter", "pro", "elite"],
        },
        {
          href: "/liquidez",
          title: "Liquidaciones",
          icon: <Wallet className="w-5 h-5 text-primary" />,
          description: "Registro y control de liquidaciones.",
          requiresAdmin: true,
          plans: ["starter", "pro", "elite"],
        },
      ],
      [
        {
          href: "/fotovoltaica",
          title: "Fotovoltaica",
          icon: <Sun className="w-5 h-5 text-primary" />,
          description: "Solicita tu estudio fotovoltaico.",
          plans: ["pro", "elite"],
        },
      ],
    ],
  },
  {
    title: "Gestión",
    icon: <FileText className="w-4 h-4 mr-2" />,
    subtitle: "Gestión organizativa",
    description:
      "Administra relaciones clave, documentación y estructura interna de tu organización.",
    columns: [
      [
        {
          href: "/clientes",
          title: "Clientes",
          icon: <BookUser className="w-5 h-5 text-primary" />,
          description: "Gestión y seguimiento de clientes.",
          plans: ["starter", "pro", "elite"],
        },
        {
          href: "/comercializadoras",
          title: "Comercializadoras",
          icon: <Factory className="w-5 h-5 text-primary" />,
          description: "Gestión de proveedores energéticos.",
          plans: ["starter", "pro", "elite"],
        },
        {
          href: "/documentacion",
          title: "Documentación",
          icon: <FolderOpen className="w-5 h-5 text-primary" />,
          description: "Archivos y documentos asociados.",
          plans: ["starter", "pro", "elite"],
        },
      ],
      [
        {
          href: "/colaboradores",
          title: "Colaboradores",
          icon: <Users className="w-5 h-5 text-primary" />,
          description: "Control de usuarios y colaboradores.",
          plans: ["starter", "pro", "elite"],
        },
        {
          href: "/difusiones",
          title: "Difusiones",
          icon: <Megaphone className="w-5 h-5 text-primary" />,
          description: "Comunicaciones y campañas informativas.",
          requiresAdmin: true,
          comingSoon: true,
          plans: ["pro", "elite"],
        },
      ],
    ],
  },
];

// Main Component
export default function NavigationMenuComponent({
  activeOrganization,
  className,
}: NavigationMenuProps) {
  const { userPlan, isAdmin, isElite } = useNavigationAccess();
  const menuSections = useMemo(() => getMenuSections(), []);

  return (
    <NavigationMenu className={cn("z-20", className)}>
      <NavigationMenuList className="gap-1">
        {/* Dashboard item */}
        <NavigationMenuItem>
          <NavigationMenuLink asChild>
            <Link
              href="/"
              className={cn(
                navigationMenuTriggerStyle(),
                "bg-white hover:bg-primary-50 transition-all"
              )}
              aria-label="Ir al Dashboard"
            >
              <Home className="w-4 h-4 mr-2" aria-hidden="true" />
              Dashboard
            </Link>
          </NavigationMenuLink>
        </NavigationMenuItem>

        {/* Dynamic menu sections */}
        {menuSections.map((section, index) => (
          <MenuSectionComponent
            key={index}
            section={section}
            isAdmin={isAdmin}
            userPlan={userPlan}
            activeOrganization={activeOrganization}
            showUpgrade={!isElite && isAdmin}
          />
        ))}
      </NavigationMenuList>
    </NavigationMenu>
  );
}
