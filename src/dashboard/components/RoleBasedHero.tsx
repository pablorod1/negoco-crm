import { User } from "@/core/types";
import { DashboardCardValue } from "@/dashboard/hooks/useDashboardData";
import { HeroMetric } from "@/dashboard/config/roleLayouts";
import Hero from "./Hero";

interface RoleBasedHeroProps {
  userData: User;
  clients: DashboardCardValue;
  activeTramites: DashboardCardValue;
  totalBalance: number;
  comparativas: DashboardCardValue;
  totalConsumption: number;
  refreshData: () => void;
  getPlan: () => string | null;
  metrics?: HeroMetric[];
}

export const RoleBasedHero = ({
  userData,
  clients,
  activeTramites,
  totalBalance,
  comparativas,
  totalConsumption,
  refreshData,
  getPlan,
}: RoleBasedHeroProps) => {
  // For now, we'll use the existing Hero component with all data
  // In the future, we could filter the metrics based on the metrics prop
  return (
    <Hero
      userData={userData}
      clients={clients}
      activeTramites={activeTramites}
      totalBalance={totalBalance}
      comparativas={comparativas}
      totalConsumption={totalConsumption}
      refreshData={refreshData}
      getPlan={getPlan}
    />
  );
};
