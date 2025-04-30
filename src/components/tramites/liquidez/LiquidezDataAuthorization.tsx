"use client";
import { useUser } from "@/lib/contexts/UserContext";
import { useEffect } from "react";
import { DataTable } from "../table/Table";
import { showCustomToast } from "@/components/core/CustomToast";
import { ShieldAlert } from "lucide-react";
import { LiquidezColumns } from "./LiquidezColumns";
import { useTransitionRouter } from "next-view-transitions";
import { slideOut } from "@/lib/view-transitions/view-transitions";

export default function LiquidezDataAuthorization() {
  const { userData } = useUser();
  const router = useTransitionRouter();

  const isComercial = userData && userData.role === "2";

  useEffect(() => {
    if (isComercial) {
      showCustomToast({
        title: "No autorizado",
        message: "No tienes permisos para acceder a esta sección",
        icon: ShieldAlert,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
      router.push("/", {
        onTransitionReady: slideOut,
      });
    }
  }, [isComercial, router]);

  // Only render content if authorized
  if (!userData) {
    return null; // Show nothing while checking/redirecting
  }

  return (
    <section className="pb-12">
      <DataTable title="Liquidez" columns={LiquidezColumns} />
    </section>
  );
}
