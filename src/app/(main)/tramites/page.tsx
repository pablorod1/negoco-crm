"use client";
import {
  ComercialTramiteColumns,
  SubComercialTramitesColumns,
  TramiteColumns,
} from "@/tramites/components/table/TramiteColumns";
import { DataTable } from "@/tramites/components/table/Table";
import { useUser } from "@/core/contexts/UserContext";
import { useEffect, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { TramiteRow } from "@/tramites/types";

export default function TramitesPage() {
  const { userData } = useUser();
  const [columns, setColumns] = useState<ColumnDef<TramiteRow>[]>([]);

  useEffect(() => {
    if (userData) {
      if (userData.role === "2" && userData.super_id) {
        setColumns(SubComercialTramitesColumns);
      } else if (userData.role === "2" && !userData.super_id) {
        setColumns(ComercialTramiteColumns);
      } else if (userData.role === "1" || userData.role === "admin") {
        setColumns(TramiteColumns);
      }
    }
  }, [userData]);
  return (
    <section className="pb-12 px-4 bg-white rounded-2xl shadow-2xl">
      <DataTable title="Trámites" columns={columns} />
    </section>
  );
}
