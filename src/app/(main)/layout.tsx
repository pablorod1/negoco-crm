"use client";
import "../globals.css";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { SidebarComponent } from "@/components/core/sidebar/Sidebar";
import Header from "@/components/core/Header";
import { Toaster } from "react-hot-toast";
import { TramitesProvider } from "@/lib/contexts/TramitesContext";
import { UserProvider } from "@/lib/contexts/UserContext";
import { UsersProvider } from "@/lib/contexts/UsersContext";
import { ComparativasProvider } from "@/lib/contexts/ComparativasContext";
import { HeroUIProvider } from "@heroui/react";

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <HeroUIProvider locale="es-ES">
      <UserProvider>
        <UsersProvider>
          <SidebarProvider defaultOpen={false}>
            <Toaster position="bottom-right" />
            <SidebarComponent />
            <SidebarInset>
              <Header />
              <TramitesProvider>
                <ComparativasProvider>{children}</ComparativasProvider>
              </TramitesProvider>
            </SidebarInset>
          </SidebarProvider>
        </UsersProvider>
      </UserProvider>
    </HeroUIProvider>
  );
}
