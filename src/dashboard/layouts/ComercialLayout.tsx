import { User } from "@/core/types";
import { DashboardData } from "@/dashboard/hooks/useDashboardData";
import { motion, AnimatePresence } from "framer-motion";
import type { Transition } from "framer-motion";
import PersonalTramitesChart from "@/dashboard/components/charts/PersonalTramitesBarChart";
import { ObjetivosCard } from "@/dashboard/components/objectives/ObjectivesSection";
import { TeamTramitesBarChart } from "@/dashboard/components/charts/TeamTramitesBarChar";
import { IncidenciasView } from "@/dashboard/components/incidencias/IncidenciasView";
import type { DashboardView } from "../components/ViewToggle";

type NonAdminDashboardView = Exclude<DashboardView, "metrics" | "sips">;

interface ComercialLayoutProps {
  userData: User;
  loading: boolean;
  dashboardData: DashboardData;
  refreshData: () => void;
  hasSubComerciales?: boolean;
  view?: NonAdminDashboardView;
}

export const ComercialLayout = ({
  userData,
  loading,
  hasSubComerciales = false,
  view = "main",
}: ComercialLayoutProps) => {
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

  // Incidencias view
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

  // Main view
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="main"
        initial="initial"
        animate="in"
        exit="out"
        variants={pageVariants}
        transition={pageTransition}
        className="space-y-6"
      >
        {/* Responsive Grid Layout */}
        <div
          className={`grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 `}
        >
          {/* First Row */}
          {/* PersonalChart */}
          <motion.div
            className="md:col-span-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
          >
            <PersonalTramitesChart userData={userData} loading={loading} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.3 }}
          >
            <ObjetivosCard loading={loading} userData={userData} />
          </motion.div>

          {/* Second Row */}

          {/* TeamChart - Solo si tiene equipo */}
          {hasSubComerciales ? (
            <motion.div
              className="md:col-span-2 lg:col-span-3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.3 }}
            >
              <TeamTramitesBarChart loading={loading} userData={userData} />
            </motion.div>
          ) : null}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
