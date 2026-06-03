import { User } from "@/core/types";
import { DashboardData } from "@/dashboard/hooks/useDashboardData";
import PersonalTramitesChart from "@/dashboard/components/charts/PersonalTramitesBarChart";
import RenewableTramitesCalendar from "@/dashboard/components/renewable/RenewableTramitesCalendar";
import { AnimatePresence, motion } from "framer-motion";
import type { Transition } from "framer-motion";
import { IncidenciasView } from "@/dashboard/components/incidencias/IncidenciasView";
import type { DashboardView } from "../components/ViewToggle";

type NonAdminDashboardView = Exclude<DashboardView, "metrics">;

interface BackofficeLayoutProps {
  userData: User;
  loading: boolean;
  dashboardData: DashboardData;
  refreshData: () => void;
  view?: NonAdminDashboardView;
}

export const BackofficeLayout = ({
  userData,
  loading,
  view = "main",
}: BackofficeLayoutProps) => {
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
      {/* Responsive Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* PersonalTramitesChart - Spans multiple columns based on screen size */}
        <div className="md:col-span-2">
          <PersonalTramitesChart userData={userData} loading={loading} />
        </div>
        {/* RenewableTramitesCalendar */}
        <div>
          <RenewableTramitesCalendar userData={userData} loading={loading} />
        </div>
      </div>
    </div>
  );
};
