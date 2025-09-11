import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTransitionRouter } from "next-view-transitions";
import { ShieldAlert } from "lucide-react";
import { ClientListItem } from "@/clientes/components/ClientsList";
import { User } from "@/core/types";
import { showCustomToast } from "@/core/components/CustomToast";

interface UseClientDetailsParams {
  userData: User | null;
}

export function useClientDetails({ userData }: UseClientDetailsParams) {
  const { id } = useParams();
  const router = useTransitionRouter();
  const [client, setClient] = useState<ClientListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadedData, setLoadedData] = useState(false);

  const fetchClient = useCallback(async () => {
    if (!userData?.id || !id) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/v2/clients/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userData.id,
          user_role: userData.role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle 403 Forbidden errors
        if (response.status === 403) {
          showCustomToast({
            title: "Acceso denegado",
            message: data.error || "No tienes permisos para ver este cliente.",
            icon: ShieldAlert,
            iconSize: 24,
            iconColor: "var(--danger-color)",
          });
          router.push("/clientes");
          return;
        }

        throw new Error(
          data.error || `Error ${response.status}: ${response.statusText}`
        );
      }

      // Validate response data
      if (!data.success || !data.data) {
        throw new Error("Los datos del cliente no están disponibles");
      }

      setClient(data.data);
      setLoadedData(true);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Error al obtener el cliente.";
      console.error("Error fetching client:", error);

      showCustomToast({
        title: "Error",
        message: errorMessage,
        icon: ShieldAlert,
        iconSize: 24,
        iconColor: "var(--danger-color)",
      });
    } finally {
      setLoading(false);
    }
  }, [id, userData, router]);

  useEffect(() => {
    fetchClient();
  }, [fetchClient]);

  return {
    client,
    loading,
    loadedData,
    fetchClient,
  };
}
