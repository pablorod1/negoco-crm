import { useCallback, useEffect, useState } from "react";
import { CloudAlert } from "lucide-react";

import { useUser } from "@/core/contexts/UserContext";
import { showCustomToast } from "@/core/components/CustomToast";
import { ComercializadoraVM } from "../types";

export function useComercializadoras() {
  const { userData } = useUser();
  const [comercializadoras, setComercializadoras] = useState<
    ComercializadoraVM[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchComercializadoras = useCallback(async () => {
    if (!userData) return;

    try {
      setLoading(true);
      setError(null);

      // Use new endpoint
      const endpoint = "/api/v2/energy-suppliers";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: userData.id,
          user_role: userData.role,
        }),
      });

      const result = await response.json();

      // Handle both old and new response formats
      const success =
        result.success !== undefined ? result.success : !result.error;
      const data = result.data;
      const apiError = result.error;

      if (!success) {
        const errorMessage = apiError || "Error al obtener comercializadoras";
        setError(errorMessage);
        showCustomToast({
          title: "Error",
          message:
            errorMessage || "No se pudieron cargar las comercializadoras",
          icon: CloudAlert,
          iconColor: "var(--danger-color)",
          iconSize: 24,
        });
        return;
      }

      setComercializadoras(data);
    } catch (err) {
      const errorMessage = "Error de conexión";
      setError(errorMessage);
      console.error("Error fetching comercializadoras:", err);
    } finally {
      setLoading(false);
    }
  }, [userData]);

  useEffect(() => {
    fetchComercializadoras();
  }, [fetchComercializadoras]);

  return {
    comercializadoras,
    loading,
    error,
    refetch: fetchComercializadoras,
  };
}
