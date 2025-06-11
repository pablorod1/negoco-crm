"use client";

import { useState } from "react";

import { ComercializadorasGrid } from "@/components/comercializadoras/ComercializadorasGrid";
import { ComercializadorasHeader } from "@/components/comercializadoras/ComercializadorasHeader";
import { ComercializadorasFilters } from "@/components/comercializadoras/ComercializadorasFilters";
import { ComercializadorasStats } from "@/components/comercializadoras/ComercializadorasStats";
import { useComercializadoras } from "@/lib/hooks/comercializadoras/useComercializadoras";
import FullScreenLoaderComponent from "../core/FullScreenLoaderComponent";

export default function ComercializadorasList() {
  const { comercializadoras, loading } = useComercializadoras();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");

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
      />

      <ComercializadorasGrid comercializadoras={filteredComercializadoras} />

      <ComercializadorasStats comercializadoras={comercializadoras} />
    </div>
  );
}
