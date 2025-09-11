import { useState, useCallback, useEffect } from "react";
import { CloudAlert } from "lucide-react";
import { useUser } from "@/core/contexts/UserContext";
import { showCustomToast } from "@/core/components/CustomToast";
import { ComercializadoraVM } from "@/comercializadoras/types";

/**
 * Hook for fetching a specific energy supplier by ID
 * Useful for resolving supplier names from IDs in detail views
 */
export function useEnergySupplierById(supplierId?: string) {
  const { userData } = useUser();
  const [supplier, setSupplier] = useState<ComercializadoraVM | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSupplierById = useCallback(async () => {
    if (!userData || !supplierId) return;

    try {
      setLoading(true);
      setError(null);

      // Use the new supplier by ID endpoint
      const params = new URLSearchParams({
        user_id: userData.id,
        user_role: userData.role,
      });

      const response = await fetch(
        `/api/v2/energy-suppliers/${supplierId}?${params}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const result = await response.json();

      if (!result.success) {
        const errorMessage = result.error || "Comercializadora no encontrada";
        setError(errorMessage);
        // Don't show toast for not found errors in this hook
        // since it's used for resolution and might be called with invalid IDs
        if (result.error !== "Energy supplier not found") {
          showCustomToast({
            title: "Error",
            message: errorMessage,
            icon: CloudAlert,
            iconColor: "var(--danger-color)",
            iconSize: 24,
          });
        }
        return;
      }

      setSupplier(result.data || null);
    } catch (err) {
      const errorMessage = "Error de conexión";
      setError(errorMessage);
      console.error("Error fetching energy supplier by ID:", err);
      showCustomToast({
        title: "Error",
        message: errorMessage,
        icon: CloudAlert,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
    } finally {
      setLoading(false);
    }
  }, [userData, supplierId]);

  useEffect(() => {
    if (supplierId) {
      fetchSupplierById();
    } else {
      setSupplier(null);
      setLoading(false);
      setError(null);
    }
  }, [fetchSupplierById, supplierId]);

  return {
    supplier,
    loading,
    error,
    refetch: fetchSupplierById,
  };
}

/**
 * Hook for resolving multiple supplier IDs to names
 * Useful for batch resolution in tables and lists
 */
export function useEnergySupplierNames(supplierIds: string[]) {
  const { userData } = useUser();
  const [supplierNames, setSupplierNames] = useState<Record<string, string>>(
    {}
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSupplierNames = useCallback(async () => {
    if (!userData || supplierIds.length === 0) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch all supplier names in parallel
      const promises = supplierIds.map(async (id) => {
        const params = new URLSearchParams({
          user_id: userData.id,
          user_role: userData.role,
        });

        try {
          const response = await fetch(
            `/api/v2/energy-suppliers/${id}?${params}`,
            {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
              },
            }
          );

          const result = await response.json();
          return {
            id,
            name: result.success
              ? result.data?.name || "Desconocido"
              : "Desconocido",
          };
        } catch {
          return { id, name: "Desconocido" };
        }
      });

      const results = await Promise.all(promises);
      const nameMap = results.reduce(
        (acc, { id, name }) => {
          acc[id] = name;
          return acc;
        },
        {} as Record<string, string>
      );

      setSupplierNames(nameMap);
    } catch (err) {
      const errorMessage = "Error al cargar nombres de comercializadoras";
      setError(errorMessage);
      console.error("Error fetching supplier names:", err);
    } finally {
      setLoading(false);
    }
  }, [userData, supplierIds]);

  useEffect(() => {
    fetchSupplierNames();
  }, [fetchSupplierNames]);

  return {
    supplierNames,
    loading,
    error,
    refetch: fetchSupplierNames,
  };
}
