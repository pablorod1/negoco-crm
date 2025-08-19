import { useState, useCallback, useEffect } from "react";
import { CloudAlert } from "lucide-react";
import { showCustomToast } from "@/core/components/CustomToast";
import { ComercializadoraDetails } from "../types";

export function useComercializadora(name: string | string[] | undefined) {
  const [comercializadora, setComercializadora] =
    useState<ComercializadoraDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchComercializadora = useCallback(async () => {
    if (!name) {
      const errorMsg =
        "No se ha proporcionado el nombre de la comercializadora";
      setError(errorMsg);
      showCustomToast({
        title: "Error",
        message: errorMsg,
        icon: CloudAlert,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Updated to use the new refactored endpoint
      // New endpoint: /api/v2/energy-suppliers/by-name/[name]
      const response = await fetch(`/api/v2/energy-suppliers/by-name/${name}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const { success, error, data } = await response.json();
      if (!success) {
        const errorMsg = error || "No se pudo cargar la comercializadora";
        setError(errorMsg);
        showCustomToast({
          title: "Error",
          message: errorMsg,
          icon: CloudAlert,
          iconColor: "var(--danger-color)",
          iconSize: 24,
        });
        return;
      }

      setComercializadora(data);
    } catch (err) {
      console.error("Error fetching comercializadora:", err);
      const errorMsg = "No se pudo conectar con el servidor";
      setError(errorMsg);
      showCustomToast({
        title: "Error",
        message: errorMsg,
        icon: CloudAlert,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
    } finally {
      setLoading(false);
    }
  }, [name]);

  useEffect(() => {
    fetchComercializadora();
  }, [fetchComercializadora]);

  return { comercializadora, loading, error, refetch: fetchComercializadora };
}
