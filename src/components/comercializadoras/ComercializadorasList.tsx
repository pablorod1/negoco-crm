"use client";

import { useState } from "react";

import { ComercializadorasGrid } from "@/components/comercializadoras/ComercializadorasGrid";
import { ComercializadorasHeader } from "@/components/comercializadoras/ComercializadorasHeader";
import { ComercializadorasFilters } from "@/components/comercializadoras/ComercializadorasFilters";
import { ComercializadorasStats } from "@/components/comercializadoras/ComercializadorasStats";
import { useComercializadoras } from "@/lib/hooks/comercializadoras/useComercializadoras";
import FullScreenLoaderComponent from "../core/FullScreenLoaderComponent";
import { useUser } from "@/lib/contexts/UserContext";
import { User } from "@/lib/core/types";

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
    <div className="px-8 py-12 space-y-6">
      <ComercializadorasHeader />

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

      <ComercializadorasStats comercializadoras={comercializadoras} />
    </div>
  );
}
