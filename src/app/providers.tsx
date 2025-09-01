"use client";
import { SidebarProvider } from "@/core/components/ui/sidebar";
import { TooltipProvider } from "@/core/components/ui/tooltip";
import { ComparativasProvider } from "@/core/contexts/ComparativasContext";
import { FotovoltaicasProvider } from "@/core/contexts/FotovoltaicasContext";
import { TramitesProvider } from "@/core/contexts/TramitesContext";
import { UserProvider } from "@/core/contexts/UserContext";
import { UsersProvider } from "@/core/contexts/UsersContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <UserProvider>
        <UsersProvider>
          <TramitesProvider>
            <ComparativasProvider>
              <FotovoltaicasProvider>
                <SidebarProvider>{children}</SidebarProvider>
              </FotovoltaicasProvider>
            </ComparativasProvider>
          </TramitesProvider>
        </UsersProvider>
      </UserProvider>
    </TooltipProvider>
  );
}
