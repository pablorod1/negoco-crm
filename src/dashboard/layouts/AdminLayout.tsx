import { User } from "@/core/types";
import { DashboardData } from "@/dashboard/hooks/useDashboardData";
import { motion, AnimatePresence } from "framer-motion";
import type { Transition } from "framer-motion";
import YearlyTramitesBarChart from "@/dashboard/components/charts/YearlyTramitesBarChart";
import PersonalTramitesChart from "@/dashboard/components/charts/PersonalTramitesBarChart";
import { TeamTramitesBarChart } from "@/dashboard/components/charts/TeamTramitesBarChar";
import { MetricsView } from "@/dashboard/components/charts/MetricsView";
import RenewableTramitesCalendar from "@/dashboard/components/renewable/RenewableTramitesCalendar";
import { ObjetivosCard } from "@/dashboard/components/objectives/ObjectivesSection";
import { IncidenciasView } from "@/dashboard/components/incidencias/IncidenciasView";

interface AdminLayoutProps {
  userData: User;
  loading: boolean;
  dashboardData: DashboardData;
  refreshData: () => void;
  view?: "main" | "metrics" | "incidencias";
}

export const AdminLayout = ({
  userData,
  loading,
  view = "main",
}: AdminLayoutProps) => {
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
          <motion.div
            className="lg:col-span-1"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
          >
            <MetricsView loading={loading} userData={userData} />
          </motion.div>
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
        {/* Primary Section - Company Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <motion.div
            className="lg:col-span-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
          >
            <YearlyTramitesBarChart loading={loading} userData={userData} />
          </motion.div>
          <motion.div
            className="lg:col-span-1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.3 }}
          >
            <RenewableTramitesCalendar userData={userData} loading={loading} />
          </motion.div>
        </div>

        {/* Secondary Section - Management Tools */}
        <div className={`grid grid-cols-1 gap-6 lg:grid-cols-3`}>
          <motion.div
            className="lg:col-span-1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.3 }}
          >
            <ObjetivosCard loading={loading} userData={userData} />
          </motion.div>
          <motion.div
            className="lg:col-span-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.3 }}
          >
            <PersonalTramitesChart userData={userData} loading={loading} />
          </motion.div>
        </div>

        <motion.div
          className="lg:col-span-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.3 }}
        >
          <TeamTramitesBarChart userData={userData} loading={loading} />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
