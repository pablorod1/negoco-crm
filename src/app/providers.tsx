"use client";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ComparativasProvider } from "@/lib/contexts/ComparativasContext";
import { FotovoltaicasProvider } from "@/lib/contexts/FotovoltaicasContext";
import { TramitesProvider } from "@/lib/contexts/TramitesContext";
import { UserProvider } from "@/lib/contexts/UserContext";
import { UsersProvider } from "@/lib/contexts/UsersContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <UserProvider>
        <UsersProvider>
          <TramitesProvider>
            <ComparativasProvider>
              <FotovoltaicasProvider>{children}</FotovoltaicasProvider>
            </ComparativasProvider>
          </TramitesProvider>
        </UsersProvider>
      </UserProvider>
    </TooltipProvider>
  );
}
