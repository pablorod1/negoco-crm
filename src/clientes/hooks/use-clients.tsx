import { useState, useEffect, useMemo, useCallback } from "react";
import { showCustomToast } from "@/core/components/CustomToast";
import { ClientListItem } from "@/clientes/components/ClientsList";
import { CloudAlert } from "lucide-react";

type SortOrder = "asc" | "desc" | null;

export function useClients(
  userId: string | undefined,
  userRole: string | undefined
) {
  const [allClients, setAllClients] = useState<ClientListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>(null);

  const fetchClients = useCallback(async () => {
    if (!userId || !userRole) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/v2/clients`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: userId, role: userRole }),
      });

      const { success, data, error } = await response.json();

      if (!success) {
        setError(error);
        showCustomToast({
          title: "Error",
          message: error,
          icon: CloudAlert,
          iconSize: 24,
          iconColor: "var(--danger-color)",
        });
        return;
      }

      if (data && data.length > 0) {
        setAllClients(data);
      } else {
        setAllClients([]);
        if (data && data.length === 0) {
          // Only show toast if data is empty array (not null/undefined)
          showCustomToast({
            title: "Sin clientes",
            message: "No se encontraron clientes.",
            icon: CloudAlert,
            iconSize: 24,
            iconColor: "var(--warning-color)",
          });
        }
      }
    } catch (error) {
      console.error("Error fetching clients:", error);
      setError("Error al cargar los clientes");
      showCustomToast({
        title: "Error",
        message: "Error al cargar los clientes.",
        icon: CloudAlert,
        iconSize: 24,
        iconColor: "var(--danger-color)",
      });
    } finally {
      setLoading(false);
    }
  }, [userId, userRole]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // Filter clients based on search term
  const filteredClients = useMemo(() => {
    if (!searchTerm.trim()) {
      return allClients;
    }

    const normalizedSearch = searchTerm
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

    return allClients.filter((client) => {
      const fullName = `${client.name || ""} ${client.last_name || ""}`
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      const email = (client.email || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      const document = (client.document_number || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      const phone = (client.phone || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

      return (
        fullName.includes(normalizedSearch) ||
        email.includes(normalizedSearch) ||
        document.includes(normalizedSearch) ||
        phone.includes(normalizedSearch)
      );
    });
  }, [allClients, searchTerm]);

  // Sort clients based on the selected order
  const sortedClients = useMemo(() => {
    if (!sortOrder) return filteredClients;

    return [...filteredClients].sort((a, b) => {
      const nameA = `${a.name || ""} ${a.last_name || ""}`.toLowerCase();
      const nameB = `${b.name || ""} ${b.last_name || ""}`.toLowerCase();

      if (sortOrder === "asc") {
        return nameA.localeCompare(nameB);
      } else {
        return nameB.localeCompare(nameA);
      }
    });
  }, [filteredClients, sortOrder]);

  return {
    fetchClients,
    clients: sortedClients,
    allClients,
    loading,
    error,
    searchTerm,
    setSearchTerm,
    sortOrder,
    setSortOrder,
    resultsCount: sortedClients.length,
    totalCount: allClients.length,
  };
}
