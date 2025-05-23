"use client";

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { useUser } from "@/lib/contexts/UserContext";
import { cn } from "@/lib/core/utils";
import * as React from "react";
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
import { Link } from "next-view-transitions";

// Type definitions for menu items
type MenuItemType = {
  href: string;
  title: string;
  icon: React.ReactNode;
  description: string;
  requiresAdmin?: boolean;
  comingSoon?: boolean;
};

type MenuSectionType = {
  title: string;
  icon: React.ReactNode;
  banner?: React.ReactNode;
  columns: MenuItemType[][];
};

export default function NavigationMenuComponent({
  activeOrganization,
}: {
  activeOrganization: string;
}) {
  const { userData } = useUser();
  const isDireccion = userData?.role === "admin" || userData?.role === "1";

  // Operations menu configuration
  const operationsMenu: MenuSectionType = {
    title: "Operaciones",
    icon: <BarChart3 className="w-4 h-4 mr-2" />,
    banner: (
      <div className="relative rounded-xl bg-gradient-to-b from-white to-primary-50 p-4 flex flex-col justify-between gap-8 shadow-sm">
        <Image
          src={
            activeOrganization === "beenergy"
              ? "/beenergy.png"
              : "/logo_inline.png"
          }
          alt="Logo"
          width={200}
          height={200}
          className="w-48 h-auto"
        />
        <div>
          <h4 className="text-sm font-semibold text-primary mb-2">
            Gestiona tus operaciones
          </h4>
          <p className="text-xs text-muted-foreground leading-snug">
            Accede a la información de tus operaciones y gestiona trámites,
            liquidaciones y comparativas de tarifas.
          </p>
        </div>
      </div>
    ),
    columns: [
      [
        {
          href: "/comparativas",
          title: "Comparativas",
          icon: <ArrowRightLeft className="w-5 h-5 text-primary" />,
          description: "Solicita tu comparativa energética.",
        },
        {
          href: "/tramites",
          title: "Trámites",
          icon: <ClipboardList className="w-5 h-5 text-primary" />,
          description: "Gestión de trámites y seguimiento.",
        },
        {
          href: "/liquidez",
          title: "Liquidaciones",
          icon: <Wallet className="w-5 h-5 text-primary" />,
          description: "Registro y control de liquidaciones.",
          requiresAdmin: true,
        },
      ],
      [
        {
          href: "/fotovoltaica",
          title: "Fotovoltaica",
          icon: <Sun className="w-5 h-5 text-primary" />,
          description: "Solicita tu estudio fotovoltaico.",
          comingSoon: true,
        },
      ],
    ],
  };

  // Management menu configuration
  const managementMenu: MenuSectionType = {
    title: "Gestión",
    icon: <FileText className="w-4 h-4 mr-2" />,
    banner: (
      <div className="relative rounded-xl bg-gradient-to-b from-white to-primary-50 p-4 flex flex-col justify-between shadow-sm">
        <Image
          src={
            activeOrganization === "beenergy"
              ? "/beenergy.png"
              : "/logo_inline.png"
          }
          alt="Logo"
          width={200}
          height={200}
          className="w-48 h-auto"
        />
        <div>
          <h4 className="text-sm font-semibold text-primary mb-2">
            Gestión organizativa
          </h4>
          <p className="text-xs text-muted-foreground leading-snug">
            Administra relaciones clave, documentación y estructura interna de
            tu organización.
          </p>
        </div>
      </div>
    ),
    columns: [
      [
        {
          href: "/clientes",
          title: "Clientes",
          icon: <BookUser className="w-5 h-5 text-primary" />,
          description: "Gestión y seguimiento de clientes.",
        },
        {
          href: "/comercializadoras",
          title: "Comercializadoras",
          icon: <Factory className="w-5 h-5 text-primary" />,
          description: "Gestión de proveedores energéticos.",
          comingSoon: true,
        },
        {
          href: "/documentacion",
          title: "Documentación",
          icon: <FolderOpen className="w-5 h-5 text-primary" />,
          description: "Archivos y documentos asociados.",
        },
      ],
      [
        {
          href: "/colaboradores",
          title: "Colaboradores",
          icon: <Users className="w-5 h-5 text-primary" />,
          description: "Control de usuarios y colaboradores.",
        },
        {
          href: "/difusiones",
          title: "Difusiones",
          icon: <Megaphone className="w-5 h-5 text-primary" />,
          description: "Comunicaciones y campañas informativas.",
          requiresAdmin: true,
          comingSoon: true,
        },
      ],
    ],
  };

  return (
    <NavigationMenu className="z-20">
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
            >
              <Home className="w-4 h-4 mr-2" />
              Dashboard
            </Link>
          </NavigationMenuLink>
        </NavigationMenuItem>

        {/* Operations menu section */}
        <MenuSection section={operationsMenu} isDireccion={isDireccion} />

        {/* Management menu section */}
        <MenuSection section={managementMenu} isDireccion={isDireccion} />
      </NavigationMenuList>
    </NavigationMenu>
  );
}

// Menu Section Component
function MenuSection({
  section,
  isDireccion,
}: {
  section: MenuSectionType;
  isDireccion: boolean;
}) {
  return (
    <NavigationMenuItem>
      <NavigationMenuTrigger className="bg-white hover:bg-primary-50 transition-all">
        {section.icon}
        {section.title}
      </NavigationMenuTrigger>
      <NavigationMenuContent>
        <div
          className={cn(
            "grid gap-4 bg-card rounded-xl p-4",
            section.columns.length === 1
              ? "md:w-[600px] lg:w-[700px] grid-cols-1 lg:grid-cols-[0.8fr_1.2fr]"
              : "md:w-[700px] lg:w-[900px] grid-cols-1 lg:grid-cols-[1fr_1fr_1fr]"
          )}
        >
          {section.banner}

          {section.columns.map((column, index) => (
            <ul key={index} className="flex flex-col gap-3">
              {column.map(
                (item, itemIndex) =>
                  (!item.requiresAdmin || isDireccion) && (
                    <ListItem
                      key={itemIndex}
                      href={item.href}
                      title={item.title}
                      icon={item.icon}
                      comingSoon={item.comingSoon}
                    >
                      <span className="text-xs">{item.description}</span>
                    </ListItem>
                  )
              )}
            </ul>
          ))}
        </div>
      </NavigationMenuContent>
    </NavigationMenuItem>
  );
}

const ListItem = React.forwardRef<
  React.ElementRef<"a">,
  React.ComponentPropsWithoutRef<"a"> & {
    icon?: React.ReactNode;
    comingSoon?: boolean;
  }
>(({ className, title, children, icon, comingSoon, ...props }, ref) => {
  return (
    <li>
      <NavigationMenuLink asChild>
        <Link
          ref={ref}
          href={props.href as string}
          className={cn(
            "flex items-start gap-3 select-none rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
            comingSoon && "opacity-70 cursor-not-allowed pointer-events-none",
            className
          )}
          {...(!comingSoon
            ? props
            : { onClick: (e) => e.preventDefault(), ...props })}
        >
          {icon && <div className="flex-shrink-0 mt-0.5">{icon}</div>}
          <div className="space-y-1">
            <div className="text-sm font-medium leading-none flex items-center gap-2">
              {title}
              {comingSoon && (
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  Próximamente
                </span>
              )}
            </div>
            <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
              {children}
            </p>
          </div>
        </Link>
      </NavigationMenuLink>
    </li>
  );
});
ListItem.displayName = "ListItem";
