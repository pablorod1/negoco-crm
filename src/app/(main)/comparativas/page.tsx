"use client";

import ComparativasTable from "@/components/comparativas/table/ComparativasTable";
import { useUser } from "@/lib/contexts/UserContext";
import { ComparativaRow } from "@/lib/core/types";
import { ColumnDef } from "@tanstack/react-table";
import { useEffect, useState } from "react";
import {
  createComercialComparativasColumns,
  createComparativasColumns,
  SubcomercialComparativasColumns,
  useComparativasState,
} from "@/components/comparativas/table/ComparativasColumns";

export default function ComparativasPage() {
  const { userData } = useUser();
  const { handlePlanChange, getSelectedPlan } = useComparativasState();
  const [columns, setColumns] = useState<ColumnDef<ComparativaRow>[]>([]);

  useEffect(() => {
    if (userData) {
      if (userData.role === "2" && userData.super_id) {
        setColumns(SubcomercialComparativasColumns);
      } else if (userData.role === "2" && !userData.super_id) {
        setColumns(
          createComercialComparativasColumns(handlePlanChange, getSelectedPlan)
        );
      } else {
        setColumns(
          createComparativasColumns(handlePlanChange, getSelectedPlan)
        );
      }
    }
  }, [userData, getSelectedPlan, handlePlanChange]);

  return (
    <section className="pb-12">
      <ComparativasTable columns={columns} />
    </section>
  );
}
