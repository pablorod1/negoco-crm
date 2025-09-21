import { TooltipProvider } from "@/core/components/ui/tooltip";
import { ComparativasProvider } from "@/core/contexts/ComparativasContext";
import { FotovoltaicasProvider } from "@/core/contexts/FotovoltaicasContext";
import { TramitesProvider } from "@/core/contexts/TramitesContext";
import { UserProvider } from "@/core/contexts/UserContext";
import { UsersProvider } from "@/core/contexts/UsersContext";
import { ApiErrorProvider } from "@/core/components/ApiErrorProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <UserProvider>
        <ApiErrorProvider>
          <UsersProvider>
            <TramitesProvider>
              <ComparativasProvider>
                <FotovoltaicasProvider>{children}</FotovoltaicasProvider>
              </ComparativasProvider>
            </TramitesProvider>
          </UsersProvider>
        </ApiErrorProvider>
      </UserProvider>
    </TooltipProvider>
  );
}
