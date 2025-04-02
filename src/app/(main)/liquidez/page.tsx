"use client";
import { LiquidezColumns } from "@/components/tramites/liquidez/LiquidezColumns";
import { DataTable } from "@/components/tramites/table/Table";
import { useUser } from "@/lib/contexts/UserContext";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { showCustomToast } from "@/components/core/CustomToast";
import { ShieldAlert } from "lucide-react";

export default function LiquidezPage() {
  const { userData } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (userData && userData.role === "2") {
      showCustomToast({
        title: "error",
        message: "No tienes permisos para acceder a esta sección",
        icon: ShieldAlert,
        iconSize: 24,
      });
      router.push("/");
    }
  }, [userData, router]);

  // Only render content if authorized
  if (!userData || userData.role === "2") {
    return null; // Show nothing while checking/redirecting
  }

  return (
    <section className="pb-12">
      <DataTable title="Liquidez" columns={LiquidezColumns} />
    </section>
  );
}
