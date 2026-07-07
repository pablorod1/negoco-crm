import { User } from "@/core/types";
import { DashboardData } from "@/dashboard/hooks/useDashboardData";
import PersonalTramitesChart from "@/dashboard/components/charts/PersonalTramitesBarChart";
import { ObjetivosCard } from "@/dashboard/components/objectives/ObjectivesSection";
import { AnimatePresence, motion } from "framer-motion";
import type { Transition } from "framer-motion";
import { IncidenciasView } from "@/dashboard/components/incidencias/IncidenciasView";
import type { DashboardView } from "../components/ViewToggle";

type NonAdminDashboardView = Exclude<DashboardView, "metrics" | "sips">;

interface SubcomercialLayoutProps {
  userData: User;
  loading: boolean;
  dashboardData: DashboardData;
  refreshData: () => void;
  view?: NonAdminDashboardView;
}

export const SubcomercialLayout = ({
  userData,
  loading,
  view = "main",
}: SubcomercialLayoutProps) => {
  const pageVariants = {
    initial: { opacity: 0, y: 20 },
    in: { opacity: 1, y: 0 },
    out: { opacity: 0, y: -20 },
  };

  const pageTransition: Transition = {
    type: "tween",
    ease: "anticipate",
    duration: 0.3,
  };

  if (view === "incidencias") {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="incidencias"
          initial="initial"
          animate="in"
          exit="out"
          variants={pageVariants}
          transition={pageTransition}
          className="space-y-6"
        >
          <IncidenciasView userData={userData} loading={loading} />
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <div className="space-y-6">
      {/* Primary Section - Personal Goals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <PersonalTramitesChart userData={userData} loading={loading} />
        </div>
        <div>
          <ObjetivosCard loading={loading} userData={userData} />
        </div>
      </div>
    </div>
  );
};
