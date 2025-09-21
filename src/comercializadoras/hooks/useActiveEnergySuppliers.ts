import { useState, useCallback, useEffect } from "react";
import { CloudAlert } from "lucide-react";
import { useUser } from "@/core/contexts/UserContext";
import { showCustomToast } from "@/core/components/CustomToast";
import { ComercializadoraVM } from "@/comercializadoras/types";

/**
 * Hook for fetching active energy suppliers (comercializadoras)
 * Optimized for form dropdowns and client-side caching
 */
export function useActiveEnergySuppliers() {
  const { userData } = useUser();
  const [activeSuppliers, setActiveSuppliers] = useState<ComercializadoraVM[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActiveSuppliers = useCallback(async () => {
    if (!userData) return;

    try {
      setLoading(true);
      setError(null);

      // Use the new active suppliers endpoint with caching
      const params = new URLSearchParams({
        user_id: userData.id,
        user_role: userData.role,
      });

      const response = await fetch(
        `/api/v2/energy-suppliers/active?${params}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const result = await response.json();

      if (!result.success) {
        const errorMessage =
          result.error || "Error al cargar comercializadoras activas";
        setError(errorMessage);
        showCustomToast({
          title: "Error",
          message: errorMessage,
          icon: CloudAlert,
          iconColor: "var(--danger-color)",
          iconSize: 24,
        });
        return;
      }

      setActiveSuppliers(result.data || []);
    } catch (err) {
      const errorMessage = "Error de conexión al cargar comercializadoras";
      setError(errorMessage);
      console.error("Error fetching active energy suppliers:", err);
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
  }, [userData]);

  useEffect(() => {
    fetchActiveSuppliers();
  }, [fetchActiveSuppliers]);

  return {
    activeSuppliers,
    loading,
    error,
    refetch: fetchActiveSuppliers,
  };
}
