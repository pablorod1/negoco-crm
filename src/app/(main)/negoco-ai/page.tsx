"use client";
import Chatbot from "@/components/core/chatbot/Chatbot";
import { showCustomToast } from "@/components/core/CustomToast";
import PlanUpgradeView from "@/components/core/PlanUpgradeView";
import { useUser } from "@/lib/contexts/UserContext";
import { slideOut } from "@/lib/view-transitions/view-transitions";
import { ShieldAlert } from "lucide-react";
import { useTransitionRouter } from "next-view-transitions";
import { useEffect, useMemo } from "react";

export default function NegocoAIPage() {
  const { userData, getPlan } = useUser();
  const router = useTransitionRouter();

  // Using useMemo for derived state
  const userPlan = useMemo(() => getPlan(), [getPlan]);
  const isStarter = useMemo(() => userPlan === "starter", [userPlan]);
  const isPro = useMemo(() => userPlan === "pro", [userPlan]);

  // Set up columns based on user role and plan
  useEffect(() => {
    if (!userData) return;

    // Redirect if user is role "2" and has starter plan
    if (userData.role === "2" && (isStarter || isPro)) {
      showCustomToast({
        title: "Acceso no autorizado",
        message:
          "La funcionalidad del asistente de IA no está disponible en el plan contratado.",
        icon: ShieldAlert,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
      router.push("/", { onTransitionReady: slideOut });
      return;
    }
  }, [userData, isStarter, router, isPro]);

  return (
    <div className="h-full">
      {isStarter || isPro ? <PlanUpgradeView /> : <Chatbot />}
    </div>
  );
}
