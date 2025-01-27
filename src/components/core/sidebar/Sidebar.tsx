"use client";
import { Inbox, LayoutDashboard, FilesIcon, Users } from "lucide-react";

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

const items = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Trámites",
    url: "/tramites",
    icon: Inbox,
  },
  {
    title: "Documentación",
    url: "/documentacion",
    icon: FilesIcon,
  },
  {
    title: "Colaboradores",
    url: "/colaboradores",
    icon: Users,
  },
];

export function SidebarComponent() {
  const { open } = useSidebar();
  const pathname = usePathname();
  return (
    <Sidebar id="sidebar-menu" collapsible="icon">
      <SidebarHeader>
        <Link href="/">
          {open ? (
            <Image
              src="/logo.webp"
              alt="Negoco CRM"
              width={633}
              height={200}
              priority
              className="w-full"
            />
          ) : (
            <Image
              src={"/logo_sin_letras.webp"}
              alt="Negoco CRM"
              width={512}
              height={488}
            />
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-8">
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    className={`${
                      pathname === item.url
                        ? "bg-[var(--primary-color-500)] text-white"
                        : ""
                    } text-lg gap-4 hover:bg-[var(--primary-color-400)] hover:text-white transition-colors duration-200 ease-in-out`}
                  >
                    <Link
                      href={item.url}
                      className="inline-flex items-center gap-2"
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            name: "Pablo Rodríguez Albarrán",
            email: "pablorodriguezalbarran2000@gmail.com",
            avatar: "",
          }}
        />
      </SidebarFooter>
    </Sidebar>
  );
}
