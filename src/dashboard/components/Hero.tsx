"use client";

import {
  Bell,
  CheckCircle,
  BarChart3,
  InfoIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  RefreshCcw,
  MoveRight,
  Zap,
} from "lucide-react";
import { Avatar } from "@/core/components/ui/avatar";
import { motion, AnimatePresence } from "framer-motion";
import { User } from "@/core/types";
import AvatarComponent from "@/core/components/AvatarComponent";
import { DashboardCardValue } from "./DashboardBentoGrid";
import { formatComission, formatConsumption } from "@/core/utils/format";
import TooltipComponent from "@/core/components/TooltipComponent";
import { Badge } from "@/core/components/ui/badge";
import { cn } from "@/core/utils";
import AddTramiteDialog from "@/tramites/components/createTramite/AddTramiteDialog";
import { TicketsData } from "../hooks/useTicketsData";
import { DashboardView as ViewType } from "./ViewToggle";

interface HeroDashboardProps {
  userData: User;
  clients: DashboardCardValue;
  activeTramites: DashboardCardValue;
  totalBalance: number;
  comparativas: DashboardCardValue;
  totalConsumption: number;
  refreshData: () => void;
  getPlan: () => string | null;
  currentView?: ViewType;
  ticketsData?: TicketsData;
}

const MotionAvatar = motion.create(Avatar);

export default function HeroDashboard({
  userData,
  clients,
  activeTramites,
  totalBalance,
  comparativas,
  totalConsumption,
  refreshData,
  getPlan,
  currentView = "main",
  ticketsData,
}: HeroDashboardProps) {
  const isPlanStarter = getPlan() === "starter";
  const isSubcomercial =
    userData && userData.role === "2" && userData.super_id !== null;

  // Determine which data to show based on view
  const isIncidenciasView = currentView === "incidencias";

  return (
    <div className="hero rounded-4xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <MotionAvatar
            className="flex justify-center items-center h-10 w-10 border border-gray-200 shadow-soft"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.3 }}
          >
            <AvatarComponent
              className="h-10 w-10 !rounded-full"
              textSize="text-xl"
              userData={userData}
            />
          </MotionAvatar>
          <div className="flex items-center gap-4">
            <motion.h1
              className="text-xl font-bold text-gray-900"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2, duration: 0.3 }}
            >
              Bienvenido, {userData.name}
            </motion.h1>
            {userData.notifications && userData.notifications > 0 ? (
              <motion.div
                className="flex items-center text-gray-600 text-xs bg-gray-50 px-3 py-2 rounded-full w-fit"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3, duration: 0.3 }}
              >
                <Bell className="w-4 h-4 mr-2 text-primary-600" />
                <span>
                  {userData.notifications} notificación
                  {userData.notifications > 1 ? "es" : ""} pendiente
                  {userData.notifications > 1 ? "s" : ""}
                </span>
              </motion.div>
            ) : (
              <motion.div
                className="flex items-center text-gray-600 text-xs bg-gray-50 px-3 py-1 rounded-full w-fit"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3, duration: 0.3 }}
              >
                <CheckCircle className="w-4 h-4 mr-2 text-gray-500" />
                <span>Sin notificaciones pendientes</span>
              </motion.div>
            )}
          </div>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-3">
          <motion.button
            className="cursor-pointer flex items-center gap-2 text-sm text-gray-600 px-3 py-2 rounded-full hover:bg-gray-100 transition-colors"
            onClick={refreshData}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.3 }}
          >
            <RefreshCcw className="w-4 h-4" />
            <span>Actualizar</span>
          </motion.button>
          <AddTramiteDialog variant="default" />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {isIncidenciasView ? (
          // Incidencias Stats Cards
          <motion.div
            key="incidencias-stats"
            className={cn("grid grid-cols-1 gap-6 mt-6 lg:grid-cols-4")}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
          >
            <StatCard
              title="Total Tickets"
              total={ticketsData?.stats.total || 0}
              value={ticketsData?.stats.total || 0}
              description="Todos los tickets"
              delay={0.1}
              key="total-tickets"
            />
            <StatCard
              title="Abiertos"
              total={ticketsData?.stats.open || 0}
              value={ticketsData?.stats.open || 0}
              description="En estado abierto"
              delay={0.2}
              key="open-tickets"
            />
            <StatCard
              title="En Proceso"
              total={ticketsData?.stats.inProgress || 0}
              value={ticketsData?.stats.inProgress || 0}
              description="Siendo procesados"
              delay={0.3}
              key="progress-tickets"
            />
            <StatCard
              title="Resueltos"
              total={ticketsData?.stats.resolved || 0}
              value={ticketsData?.stats.resolved || 0}
              description="Completados"
              delay={0.4}
              key="resolved-tickets"
            />
          </motion.div>
        ) : (
          // Default Dashboard Stats Cards
          <motion.div
            key="dashboard-stats"
            className={cn(
              "grid grid-cols-1 gap-6 mt-6",
              isPlanStarter
                ? isSubcomercial
                  ? "lg:grid-cols-3"
                  : "lg:grid-cols-4"
                : !isSubcomercial
                  ? "lg:grid-cols-3 2xl:grid-cols-5"
                  : "lg:grid-cols-4"
            )}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
          >
            <StatCard
              title="Clientes"
              value={clients.value}
              total={clients.total}
              prev_value={clients.prev_value}
              description="Total registrados"
              trend={
                clients.difference > 0
                  ? "up"
                  : clients.difference === 0
                    ? "normal"
                    : "down"
              }
              trendValue={clients.difference}
              delay={0.1}
              key="dashboard-clients"
            />
            <StatCard
              title="Trámites Activos"
              total={activeTramites.total}
              value={activeTramites.value}
              prev_value={activeTramites.prev_value}
              description="En proceso"
              trend={
                activeTramites.difference > 0
                  ? "up"
                  : activeTramites.difference === 0
                    ? "normal"
                    : "down"
              }
              trendValue={activeTramites.difference}
              delay={0.2}
              key="dashboard-tramites"
            />
            {!isPlanStarter ? (
              <StatCard
                title="Comparativas"
                total={comparativas.total}
                value={comparativas.value}
                prev_value={comparativas.prev_value}
                trend={
                  comparativas.difference > 0
                    ? "up"
                    : comparativas.difference === 0
                      ? "normal"
                      : "down"
                }
                trendValue={comparativas.difference}
                description="Completadas 2025"
                delay={0.3}
                key="dashboard-comparativas"
              />
            ) : null}

            <div
              className={cn(
                "grid grid-cols-1 gap-6",
                isPlanStarter
                  ? isSubcomercial
                    ? "lg:grid-cols-1 lg:col-span-1"
                    : "lg:grid-cols-2 lg:col-span-2 "
                  : isSubcomercial
                    ? "lg:col-span-1"
                    : "lg:grid-cols-2 lg:col-span-3 2xl:col-span-2"
              )}
            >
              <StatCard
                title="Consumo Total"
                total={totalConsumption}
                value={totalConsumption}
                description="Todos los contratos"
                delay={0.4}
                type="consumption"
                key="dashboard-consumption"
              />
              {!isSubcomercial ? (
                <StatCard
                  title="Balance"
                  total={totalBalance}
                  value={totalBalance}
                  description="Comisiones 2025"
                  type="chart"
                  delay={0.5}
                  key="dashboard-balance"
                />
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface StatCardProps {
  title: string;
  total: number;
  value: number;
  prev_value?: number;
  description: string;
  trend?: "up" | "down" | "normal";
  trendValue?: number;
  type?: "chart" | "consumption" | "default";
  delay?: number;
}

function StatCard({
  title,
  total,
  value,
  prev_value = 0,
  description,
  trend,
  trendValue,
  type = "default",
  delay = 0,
}: StatCardProps) {
  return (
    <motion.div
      className="bg-white/30 hero-card rounded-4xl shadow-2xs p-6 relative overflow-hidden"
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={{
        delay,
        duration: 0.4,
        ease: "easeOut",
        scale: { type: "spring", stiffness: 300, damping: 25 },
      }}
      layout
      whileHover={{
        scale: 1.02,
        y: -2,
        transition: { duration: 0.2 },
      }}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-sm font-medium text-gray-600 mb-1">{title}</h3>
          <motion.p
            className="text-2xl font-bold text-gray-900"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: delay + 0.1, duration: 0.3 }}
          >
            {type === "chart"
              ? formatComission(total)
              : type === "consumption"
                ? formatConsumption(total)
                : total}
          </motion.p>
        </div>
        <div className="flex items-center gap-2">
          {type === "chart" && (
            <motion.div
              className="text-gray-400"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                delay: delay + 0.2,
                type: "spring",
                stiffness: 200,
              }}
            >
              <BarChart3 className="h-5 w-5" />
            </motion.div>
          )}
          {type === "consumption" && (
            <motion.div
              className="text-gray-400"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                delay: delay + 0.2,
                type: "spring",
                stiffness: 200,
              }}
            >
              <Zap className="h-5 w-5" />
            </motion.div>
          )}
          {trend && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                delay: delay + 0.2,
                type: "spring",
                stiffness: 200,
              }}
            >
              <Badge
                variant={
                  trend === "up"
                    ? "success"
                    : trend === "normal"
                      ? "secondary"
                      : "danger"
                }
                className="h-6  rounded-full"
              >
                <div className="flex items-center gap-1">
                  {trend === "up" ? (
                    <TrendingUpIcon className="h-3 w-3" />
                  ) : trend === "normal" ? (
                    <MoveRight className="h-3 w-3" />
                  ) : (
                    <TrendingDownIcon className="h-3 w-3" />
                  )}
                  <span className="text-xs font-semibold">
                    {trendValue?.toFixed(1)}%
                  </span>
                </div>
              </Badge>
            </motion.div>
          )}
        </div>
      </div>

      <div className="flex justify-between items-center">
        <p className="text-xs text-gray-500">{description}</p>
        {trendValue !== undefined && (
          <TooltipComponent
            color="bg-white shadow-md border border-gray-200"
            content={
              <div className="p-3 max-w-xs">
                <h2 className="font-semibold text-sm mb-3 border-b pb-2 text-gray-800">
                  Comparación mensual
                </h2>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">Actual:</span>
                    <span className="font-medium text-gray-800 text-xs">
                      {value}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">Anterior:</span>
                    <span className="font-medium text-gray-800 text-xs">
                      {prev_value}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-2 pt-2 border-t">
                    <span className="text-xs text-gray-600">Variación:</span>
                    <span className={`font-medium text-xs text-white`}>
                      {trendValue > 0 ? "+" : ""}
                      {trendValue.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            }
          >
            <div className="flex items-center cursor-help">
              <InfoIcon
                size={12}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                strokeWidth={2}
              />
            </div>
          </TooltipComponent>
        )}
      </div>
    </motion.div>
  );
}
