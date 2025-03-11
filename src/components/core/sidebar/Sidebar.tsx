"use client";
import {
  LayoutDashboard,
  Users,
  ReceiptText,
  Folder,
  Coins,
  NotebookPen,
} from "lucide-react";
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
} from "@/components/ui/sidebar";
import Image from "next/image";
import Link from "next/link";
import { NavUser } from "./NavUser";
import { usePathname } from "next/navigation";
import { useUser } from "@/lib/contexts/UserContext";
import { Tooltip } from "@heroui/tooltip";

const items = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Trámites",
    url: "/tramites",
    icon: ReceiptText,
  },
  {
    title: "Documentación",
    url: "/documentacion",
    icon: Folder,
  },
  {
    title: "Colaboradores",
    url: "/colaboradores",
    icon: Users,
  },
];

const direccionItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Comparativas",
    url: "/comparativas",
    icon: NotebookPen,
  },
  {
    title: "Trámites",
    url: "/tramites",
    icon: ReceiptText,
  },
  {
    title: "Liquidez",
    url: "/liquidez",
    icon: Coins,
  },
  {
    title: "Documentación",
    url: "/documentacion",
    icon: Folder,
  },
  {
    title: "Colaboradores",
    url: "/colaboradores",
    icon: Users,
  },
];

const DEFAULT_LOGO = "/logo.webp";

export function SidebarComponent() {
  const pathname = usePathname();
  const { userData } = useUser();
  const { open } = useSidebar();
  // Obtener el logo de forma segura
  const organizationLogo = userData?.organization?.logo || DEFAULT_LOGO;

  const getItemsByRole = () => {
    if (userData) {
      if (userData.role === "admin" || userData.role === "1") {
        return direccionItems;
      } else {
        return items;
      }
    }

    return items;
  };

  return (
    <Sidebar variant="inset" id="sidebar-menu" collapsible="icon">
      <SidebarHeader className="py-4">
        <Link href="/">
          <div className="flex items-center w-auto gap-2">
            <Image
              src={organizationLogo}
              alt="Logo"
              width={60}
              height={60}
              priority
              className="w-full h-auto max-w-8"
            />
            <h2
              className={`block overflow-hidden text-3xl font-bold uppercase text-[var(--primary-color-400)] animate-size ${
                open ? "w-auto" : "w-0"
              }`}
            >
              {userData?.organization?.name}
            </h2>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-8">
              {getItemsByRole().map((item) => (
                <SidebarMenuItem key={item.title}>
                  <Tooltip radius="full" color="primary" content={item.title}>
                    <SidebarMenuButton
                      asChild
                      className={`${
                        pathname === item.url
                          ? "bg-[var(--primary-color-500)] text-white"
                          : ""
                      }  gap-4 hover:bg-[var(--primary-color-400)] hover:text-white transition-colors duration-200 ease-in-out`}
                    >
                      <Link
                        href={item.url}
                        className="inline-flex items-center"
                      >
                        <item.icon />
                        <span className="text-base">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </Tooltip>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
