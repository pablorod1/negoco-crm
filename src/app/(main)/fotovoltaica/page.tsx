"use client";
import {
  ComercialFotovoltaicaColumns,
  FotovoltaicaColumns,
  SubcomercialFotovoltaicaColumns,
} from "@/components/fotovoltaica/table/FotovoltaicaColumns";
import FotovoltaicasTable from "@/components/fotovoltaica/table/FotovoltaicasTable";
import { useUser } from "@/lib/contexts/UserContext";
import { FotovoltaicaVM } from "@/lib/core/types";
import { ColumnDef } from "@tanstack/react-table";
import { useEffect, useState } from "react";

export default function FotovoltaicaPage() {
  const { userData } = useUser();
  const [columns, setColumns] = useState<ColumnDef<FotovoltaicaVM>[]>([]);

  useEffect(() => {
    if (userData) {
      if (userData.role === "2" && userData.super_id) {
        setColumns(SubcomercialFotovoltaicaColumns);
      } else if (userData.role === "2" && !userData.super_id) {
        setColumns(ComercialFotovoltaicaColumns);
      } else if (userData.role === "1" || userData.role === "admin") {
        setColumns(FotovoltaicaColumns);
      }
    }
  }, [userData]);

  return (
    <section className="pb-12 px-4">
      <FotovoltaicasTable columns={columns} />
    </section>
  );
}
