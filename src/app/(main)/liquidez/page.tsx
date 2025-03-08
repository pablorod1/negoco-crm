"use client";
import { LiquidezColumns } from "@/components/tramites/liquidez/LiquidezColumns";
import { DataTable } from "@/components/tramites/table/Table";
import { useUser } from "@/lib/contexts/UserContext";
import { useEffect } from "react";

export default function LiquidezPage() {
  const { userData } = useUser();

  useEffect(() => {
    if (userData && userData.role !== "admin" && userData.role !== "1") {
      return;
    }
  }, [userData]);
  return (
    <section className="pb-12">
      <DataTable title="Liquidez" columns={LiquidezColumns} />
    </section>
  );
}
