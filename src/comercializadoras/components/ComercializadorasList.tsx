"use client";

import { useCallback, useMemo, useState } from "react";
import { ClipboardList, CloudAlert, FileText } from "lucide-react";

import { ComercializadorasBulkStatus } from "@/comercializadoras/components/ComercializadorasBulkStatus";
import { ComercializadorasGrid } from "@/comercializadoras/components/ComercializadorasGrid";
import { ComercializadorasHeader } from "@/comercializadoras/components/ComercializadorasHeader";
import { ComercializadorasFilters } from "@/comercializadoras/components/ComercializadorasFilters";
import { ComercializadorasStats } from "@/comercializadoras/components/ComercializadorasStats";
import { useComercializadoras } from "@/comercializadoras/hooks/useComercializadoras";
import { showCustomToast } from "@/core/components/CustomToast";
import FullScreenLoaderComponent from "@/core/components/FullScreenLoaderComponent";
import { useUser } from "@/core/contexts/UserContext";
import { User } from "@/core/types";
import { ComercializadoraVM } from "@/comercializadoras/types";

function showStatusToast(active: boolean, message: string) {
  showCustomToast({
    title: "Estado actualizado",
    message,
    icon: active ? ClipboardList : FileText,
    iconColor: active ? "var(--success-color)" : "var(--warning-color)",
    iconSize: 24,
  });
}

function showStatusErrorToast(error?: string) {
  showCustomToast({
    title: "Error al actualizar estado",
    message:
      error || "No se pudo actualizar el estado de la comercializadora.",
    icon: CloudAlert,
    iconColor: "var(--danger-color)",
    iconSize: 24,
  });
}

export default function ComercializadorasList() {
  const { comercializadoras, loading, updateActive } = useComercializadoras();
  const { userData } = useUser();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("active");
  const isComercial = userData?.role === "2";

  const filteredComercializadoras = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return comercializadoras.filter((comercializadora) => {
      const matchesSearch = comercializadora.name.toLowerCase().includes(term);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && comercializadora.active) ||
        (statusFilter === "inactive" && !comercializadora.active);

      return matchesSearch && matchesStatus;
    });
  }, [comercializadoras, searchTerm, statusFilter]);

  // Estable para que el memo de las tarjetas solo deje pasar la que cambia.
  const handleToggleActive = useCallback(
    async (comercializadora: ComercializadoraVM, active: boolean) => {
      const { success, error } = await updateActive(
        [comercializadora.id],
        active
      );
      if (!success) return showStatusErrorToast(error);
      showStatusToast(
        active,
        `La comercializadora ${comercializadora.name} ha sido ${active ? "activada" : "desactivada"}.`
      );
    },
    [updateActive]
  );

  const handleBulkActive = async (active: boolean) => {
    const ids = filteredComercializadoras
      .filter((c) => c.active !== active)
      .map((c) => c.id);
    if (ids.length === 0) return;

    const { success, error } = await updateActive(ids, active);
    if (!success) return showStatusErrorToast(error);
    showStatusToast(
      active,
      `${ids.length} ${ids.length === 1 ? "comercializadora" : "comercializadoras"} ${active ? "activadas" : "desactivadas"}.`
    );
  };

  if (loading) return <FullScreenLoaderComponent />;

  return (
    <div className="px-8 py-8 space-y-8">
      <ComercializadorasHeader />

      <ComercializadorasStats comercializadoras={comercializadoras} />

      <ComercializadorasFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        comercializadoras={comercializadoras}
        userData={userData as User}
        actions={
          !isComercial && (
            <ComercializadorasBulkStatus
              comercializadoras={filteredComercializadoras}
              isFiltered={searchTerm !== "" || statusFilter !== "all"}
              onConfirm={handleBulkActive}
            />
          )
        }
      />

      <ComercializadorasGrid
        comercializadoras={filteredComercializadoras}
        userData={userData as User}
        onToggleActive={handleToggleActive}
      />
    </div>
  );
}
