"use client";
import { showCustomToast } from "@/core/components/CustomToast";
import PlanUpgradeView from "@/core/components/PlanUpgradeView";
import {
  ComercialFotovoltaicaColumns,
  FotovoltaicaColumns,
  SubcomercialFotovoltaicaColumns,
} from "@/fotovoltaica/components/table/FotovoltaicaColumns";
import FotovoltaicasTable from "@/fotovoltaica/components/table/FotovoltaicasTable";
import { useUser } from "@/core/contexts/UserContext";
import { FotovoltaicaVM } from "@/fotovoltaica/types";
import { slideOut } from "@/core/view-transitions/view-transitions";
import { ColumnDef } from "@tanstack/react-table";
import { ShieldAlert } from "lucide-react";
import { useTransitionRouter } from "next-view-transitions";
import { useEffect, useMemo, useState } from "react";

export default function FotovoltaicaPage() {
  const { userData, getPlan } = useUser();
  const [columns, setColumns] = useState<ColumnDef<FotovoltaicaVM>[]>([]);
  const router = useTransitionRouter();

  // Using useMemo for derived state
  const userPlan = useMemo(() => getPlan(), [getPlan]);
  const isStarter = useMemo(() => userPlan === "starter", [userPlan]);

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

    if (userData.role === "2" && userData.super_id) {
      setColumns(SubcomercialFotovoltaicaColumns);
    } else if (userData.role === "2" && !userData.super_id) {
      setColumns(ComercialFotovoltaicaColumns);
    } else if (userData.role === "1" || userData.role === "admin") {
      setColumns(FotovoltaicaColumns);
    }
  }, [userData, isStarter, router]);

  return (
    <section className="pb-12 px-4">
      {!isStarter ? (
        <FotovoltaicasTable columns={columns} />
      ) : (
        <PlanUpgradeView />
      )}
    </section>
  );
}
