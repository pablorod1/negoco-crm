import { User } from "@/core/types";
import { DashboardData } from "@/dashboard/hooks/useDashboardData";
import PersonalTramitesChart from "@/dashboard/components/charts/PersonalTramitesBarChart";
import { ObjetivosCard } from "@/dashboard/components/objectives/ObjectivesSection";
import { AnimatePresence, motion } from "framer-motion";
import { MetricsView } from "@/dashboard/components/charts/MetricsView";
import { IncidenciasView } from "@/dashboard/components/incidencias/IncidenciasView";

interface SubcomercialLayoutProps {
  userData: User;
  loading: boolean;
  dashboardData: DashboardData;
  refreshData: () => void;
  view?: "main" | "metrics" | "incidencias";
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

  const pageTransition = {
    type: "tween",
    ease: "anticipate",
    duration: 0.3,
  };
  // Metrics view
  if (view === "metrics") {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="metrics"
          initial="initial"
          animate="in"
          exit="out"
          variants={pageVariants}
          transition={pageTransition}
          className="space-y-6"
        >
          {/* Métricas Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div
              className="lg:col-span-1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1, duration: 0.3 }}
            >
              <MetricsView loading={loading} userData={userData} />
            </motion.div>
           
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

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
