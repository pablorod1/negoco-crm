"use client";

import { Bell, CheckCircle, BarChart3, InfoIcon } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { User } from "@/lib/core/types";
import AvatarComponent from "../core/AvatarComponent";
import { DashboardCardValue } from "./DashboardBentoGrid";
import { formatComission } from "@/lib/core/format";
import { Tooltip } from "@heroui/tooltip";
import AddTramiteDialog from "../tramites/createTramite/AddTramiteDialog";
import AddComparativaDialog from "../comparativas/createComparativa/AddComparativaDialog";

interface HeroDashboardProps {
  userData: User;
  clients: DashboardCardValue;
  activeTramites: DashboardCardValue;
  pendingTramites: DashboardCardValue;
  totalBalance: number;
}

const MotionCard = motion(Card);
const MotionAvatar = motion(Avatar);

export default function HeroDashboard({
  userData,
  clients,
  activeTramites,
  pendingTramites,
  totalBalance,
}: HeroDashboardProps) {
  return (
    <MotionCard
      className="border-none shadow-sm bg-gradient-to-r from-blue-500 to-blue-400  overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <MotionAvatar
              className="flex justify-center items-center h-16 w-16 border-4 border-white/20 shadow-md"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5, type: "spring" }}
            >
              <AvatarComponent
                className="h-16 w-16 !rounded-full"
                textSize="text-xl"
                userData={userData}
              />
            </MotionAvatar>

            <div className="space-y-1">
              <motion.h1
                className="text-2xl font-bold text-white flex items-center gap-2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4, duration: 0.5 }}
              >
                Bienvenido, {userData.name}
                <motion.span
                  className="text-xl"
                  initial={{ rotate: -45, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  transition={{ delay: 0.7, duration: 0.5, type: "spring" }}
                >
                  👋
                </motion.span>
              </motion.h1>

              {userData.notifications && userData.notifications > 0 ? (
                <motion.div
                  className="flex items-center text-white/90 text-sm bg-white/10 px-3 py-1.5 rounded-full"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5, duration: 0.4 }}
                >
                  <Bell className="w-4 h-4 mr-2" />
                  <span>
                    Tienes {userData.notifications} notificaciones pendientes
                  </span>
                </motion.div>
              ) : (
                <motion.div
                  className="flex items-center text-white/90 text-sm bg-white/10 px-3 py-1.5 rounded-full"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5, duration: 0.4 }}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  <span>No tienes notificaciones pendientes</span>
                </motion.div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 mt-4 md:mt-0">
            <AddTramiteDialog color="default" />

            <AddComparativaDialog color="default" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-4 gap-4 mt-6">
          <StatCard
            title="Clientes"
            value={clients.value}
            description="Total de clientes registrados"
            trend="up"
            trendValue={clients.difference}
            delay={0.8}
          />
          <StatCard
            title="Trámites Activos"
            value={activeTramites.value}
            description="Total de trámites activos"
            trend="up"
            trendValue={activeTramites.difference}
            delay={0.9}
          />
          <StatCard
            title="Trámites Pendientes"
            value={pendingTramites.value}
            description="Total de trámites pendientes"
            delay={1.0}
          />
          <StatCard
            title="Balance Total"
            value={totalBalance}
            description="Balance total de tus comisiones 2025"
            chart
            delay={1.1}
          />
        </div>
      </CardContent>
    </MotionCard>
  );
}

interface StatCardProps {
  title: string;
  value: number;
  description: string;
  trend?: "up" | "down";
  trendValue?: number;
  chart?: boolean;
  delay?: number;
}

function StatCard({
  title,
  value,
  description,
  trend,
  trendValue,
  chart,
  delay = 0,
}: StatCardProps) {
  return (
    <motion.div
      className="bg-white/30 rounded-xl p-4 backdrop-blur-sm relative overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
    >
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-sm font-medium text-white/80">{title}</h3>
          <motion.p
            className="text-2xl font-bold text-white mt-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: delay + 0.2, duration: 0.5 }}
          >
            {chart ? formatComission(value) : value}
          </motion.p>
        </div>
        {trend && (
          <motion.div
            className={`text-xs font-semibold px-4 py-1 rounded-full ${
              trend === "up"
                ? "bg-green-500 text-white "
                : "bg-red-500/20 text-red-100"
            }`}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: delay + 0.3, type: "spring", stiffness: 200 }}
          >
            {trendValue}%
          </motion.div>
        )}
        {chart && (
          <motion.div
            className="text-white/80"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: delay + 0.3, type: "spring", stiffness: 200 }}
          >
            <BarChart3 className="h-5 w-5" />
          </motion.div>
        )}
      </div>
      <div className="flex justify-between items-center z-30">
        <p className="text-xs text-white/90 mt-2">{description}</p>
        {trendValue !== undefined && (
          <Tooltip content="Variación respecto al mes anterior">
            <InfoIcon size={14} className="text-white" strokeWidth={3} />
          </Tooltip>
        )}
      </div>

      {/* Efecto de brillo sutil en cada tarjeta */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -z-10"
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 100, opacity: [0, 1, 0] }}
        transition={{
          duration: 1.5,
          delay: delay + 0.5,
          ease: "easeInOut",
        }}
      />
    </motion.div>
  );
}
