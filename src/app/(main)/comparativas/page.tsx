"use client";

import { useEffect, useState, useMemo } from "react";
import { useTransitionRouter } from "next-view-transitions";
import { ColumnDef } from "@tanstack/react-table";
import { ShieldAlert } from "lucide-react";

import ComparativasTable from "@/comparativas/components/table/ComparativasTable";
import { showCustomToast } from "@/core/components/CustomToast";
import { useUser } from "@/core/contexts/UserContext";
import { ComparativaRow } from "@/comparativas/types";
import { slideOut } from "@/core/view-transitions/view-transitions";
import {
  createComercialComparativasColumns,
  createComparativasColumns,
  createSubcomercialComparativasColumns,
  useComparativasState,
} from "@/comparativas/components/table/ComparativasColumns";
import PlanUpgradeView from "@/core/components/PlanUpgradeView";

export default function ComparativasPage() {
  const { userData, getPlan } = useUser();
  const { handlePlanChange, getSelectedPlan } = useComparativasState();
  const [columns, setColumns] = useState<ColumnDef<ComparativaRow>[]>([]);
  const router = useTransitionRouter();

  // Using useMemo for derived state
  const userPlan = useMemo(() => getPlan(), [getPlan]);
  const isStarter = useMemo(() => userPlan === "starter", [userPlan]);

  // Set up columns based on user role and plan
  useEffect(() => {
    if (!userData) return;

    // Redirect if user is role "2" and has starter plan
    if (userData.role === "2" && isStarter) {
      showCustomToast({
        title: "Acceso no autorizado",
        message:
          "La funcionalidad de comparativas no está disponible en el plan contratado.",
        icon: ShieldAlert,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
      router.push("/", { onTransitionReady: slideOut });
      return;
    }

    // Determine which columns to use based on user role
    if (userData.role === "2" && userData.super_id) {
      setColumns(
        createSubcomercialComparativasColumns(handlePlanChange, getSelectedPlan)
      );
    } else if (userData.role === "2" && !userData.super_id) {
      setColumns(
        createComercialComparativasColumns(handlePlanChange, getSelectedPlan)
      );
    } else {
      setColumns(createComparativasColumns(handlePlanChange, getSelectedPlan));
    }
  }, [userData, getSelectedPlan, handlePlanChange, isStarter, router]);

  // Render appropriate UI based on plan
  return (
    <section className="pb-12 px-4">
      {isStarter ? (
        <PlanUpgradeView />
      ) : (
        <ComparativasTable columns={columns} />
      )}
    </section>
  );
}
