"use client";

import { useState } from "react";

import { ComercializadorasGrid } from "@/comercializadoras/components/ComercializadorasGrid";
import { ComercializadorasHeader } from "@/comercializadoras/components/ComercializadorasHeader";
import { ComercializadorasFilters } from "@/comercializadoras/components/ComercializadorasFilters";
import { ComercializadorasStats } from "@/comercializadoras/components/ComercializadorasStats";
import { useComercializadoras } from "@/comercializadoras/hooks/useComercializadoras";
import FullScreenLoaderComponent from "@/core/components/FullScreenLoaderComponent";
import { useUser } from "@/core/contexts/UserContext";
import { User } from "@/core/types";

export default function ComercializadorasList() {
  const { comercializadoras, loading, refetch } = useComercializadoras();
  const { userData } = useUser();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("active");

  const filteredComercializadoras = comercializadoras.filter(
    (comercializadora) => {
      const matchesSearch = comercializadora.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && comercializadora.active) ||
        (statusFilter === "inactive" && !comercializadora.active);

      return matchesSearch && matchesStatus;
    }
  );

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
      />

      <ComercializadorasGrid
        comercializadoras={filteredComercializadoras}
        userData={userData as User}
        refetch={refetch}
      />
    </div>
  );
}
