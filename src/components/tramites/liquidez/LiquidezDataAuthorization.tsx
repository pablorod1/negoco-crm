"use client";
import { useUser } from "@/lib/contexts/UserContext";
import { useEffect, useRef } from "react";
import { DataTable } from "../table/Table";
import { showCustomToast } from "@/components/core/CustomToast";
import { ShieldAlert } from "lucide-react";
import { LiquidezColumns } from "./LiquidezColumns";
import { useTransitionRouter } from "next-view-transitions";
import { slideOut } from "@/lib/view-transitions/view-transitions";

export default function LiquidezDataAuthorization() {
  const { userData } = useUser();
  const router = useTransitionRouter();
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;
    const isComercial = userData && userData.role === "2";
    if (isComercial && isMounted.current) {
      showCustomToast({
        title: "No autorizado",
        message: "No tienes permisos para acceder a esta sección",
        icon: ShieldAlert,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
      // Asegura que el router.push solo se ejecute si el componente sigue montado
      setTimeout(() => {
        if (isMounted.current && isActive) {
          router.push("/", {
            onTransitionReady: slideOut,
          });
        }
      }, 0);
    }
    return () => {
      isActive = false;
    };
  }, [router, userData]);

  return (
    <section className="pb-12">
      <DataTable title="Liquidez" columns={LiquidezColumns} />
    </section>
  );
}
