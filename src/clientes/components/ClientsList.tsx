"use client";
import { useUser } from "@/core/contexts/UserContext";
import LoadingStateCard from "@/dashboard/components/LoadingStateCard";
import { useClients } from "@/clientes/hooks/use-clients";
import { useEffect, useState, useRef } from "react";
import { ClientsHeader } from "./ClientsHeader";
import { ClientsFilters } from "./ClientsFilters";
import { ClientsTable } from "./ClientsTable";
import { ClientsGrid } from "./ClientsGrid";
import { ClientEmptyState } from "./ClientEmptyState";
import { ClientDB } from "@/tramites/types";
import { User } from "@/core/types";

export interface ClientListItem extends ClientDB {
  tramites_count: number;
  files_count: number;
}

export default function ClientsList() {
  const { userData } = useUser();
  const {
    clients,
    loading,
    searchTerm,
    setSearchTerm,
    sortOrder,
    setSortOrder,
    resultsCount,
    totalCount,
  } = useClients(userData?.id, userData?.role);

  // Local search state for immediate input feedback
  const [localSearchTerm, setLocalSearchTerm] = useState("");
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // View mode state (card or table)
  const [viewMode, setViewMode] = useState<"card" | "table">("card");

  // Apply search term with timeout
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setSearchTerm(localSearchTerm);
    }, 300);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [localSearchTerm, setSearchTerm]);

  // Handle search clearing
  const handleClearSearch = () => {
    setLocalSearchTerm("");
    setSearchTerm("");
  };

  return (
    <div className="space-y-6">
      <ClientsHeader totalCount={totalCount} userData={userData as User} />

      <ClientsFilters
        localSearchTerm={localSearchTerm}
        setLocalSearchTerm={setLocalSearchTerm}
        handleClearSearch={handleClearSearch}
        viewMode={viewMode}
        setViewMode={setViewMode}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
        searchTerm={searchTerm}
        resultsCount={resultsCount}
      />

      {loading ? (
        <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {[...Array(8)].map((_, index) => (
            <LoadingStateCard key={index} />
          ))}
        </div>
      ) : clients.length > 0 ? (
        viewMode === "card" ? (
          <ClientsGrid clients={clients} />
        ) : (
          <ClientsTable clients={clients} />
        )
      ) : (
        <ClientEmptyState
          searchTerm={searchTerm}
          totalCount={totalCount}
          handleClearSearch={handleClearSearch}
        />
      )}
    </div>
  );
}
