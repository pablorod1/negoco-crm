"use client";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ComparativasProvider } from "@/lib/contexts/ComparativasContext";
import { TramitesProvider } from "@/lib/contexts/TramitesContext";
import { UserProvider } from "@/lib/contexts/UserContext";
import { UsersProvider } from "@/lib/contexts/UsersContext";
import { HeroUIProvider } from "@heroui/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <HeroUIProvider locale="es-ES">
      <TooltipProvider>
        <UserProvider>
          <UsersProvider>
            <SidebarProvider defaultOpen={false}>
              <TramitesProvider>
                <ComparativasProvider>{children}</ComparativasProvider>
              </TramitesProvider>
            </SidebarProvider>
          </UsersProvider>
        </UserProvider>
      </TooltipProvider>
    </HeroUIProvider>
  );
}
