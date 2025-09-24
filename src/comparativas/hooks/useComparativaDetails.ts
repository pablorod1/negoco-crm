import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTransitionRouter } from "next-view-transitions";
import { CloudAlert, ShieldAlert } from "lucide-react";
import { ComparativaVM } from "@/comparativas/types";
import { User } from "@/core/types";
import { showCustomToast } from "@/core/components/CustomToast";

interface UseComparativaDetailsParams {
  userData: User | null;
}

export function useComparativaDetails({
  userData,
}: UseComparativaDetailsParams) {
  const { id } = useParams();
  const router = useTransitionRouter();
  const [comparativa, setComparativa] = useState<ComparativaVM | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadedData, setLoadedData] = useState(false);

  const fetchComparativa = useCallback(async () => {
    if (!userData?.id || !userData?.role) return;

    try {
      setLoading(true);
      const rs = await fetch(`/api/v2/comparisons/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          user_id: userData.id,
          user_role: userData.role,
        }),
      });

      if (rs.status === 404) {
        showCustomToast({
          title: "Acceso denegado",
          message:
            "La comparativa no existe o no tienes permiso para acceder a ella.",
          iconColor: "var(--danger-color)",
          icon: ShieldAlert,
          iconSize: 24,
        });
        router.push("/comparativas");
        return;
      }

      if (!rs.ok) {
        const errorData = await rs.json();
        showCustomToast({
          title: "Error",
          message: errorData.error || "Error al cargar la comparativa",
          icon: CloudAlert,
          iconSize: 24,
          iconColor: "var(--danger-color)",
        });
        router.push("/comparativas");
        return;
      }

      const { success, data } = await rs.json();
      if (success && data) {
        setComparativa(data);
        setLoadedData(true);
      } else {
        showCustomToast({
          title: "Error",
          message: "No se encontraron datos de la comparativa",
          icon: CloudAlert,
          iconSize: 24,
          iconColor: "var(--danger-color)",
        });
        router.push("/comparativas");
        return;
      }
    } catch (error) {
      console.error("Error en la solicitud:", error);
      showCustomToast({
        title: "Error",
        message: "Error de conexión",
        icon: CloudAlert,
        iconSize: 24,
        iconColor: "var(--danger-color)",
      });
      router.push("/comparativas");
      return;
    } finally {
      setLoading(false);
    }
  }, [id, userData?.id, userData?.role, router]);

  useEffect(() => {
    fetchComparativa();
  }, [fetchComparativa]);

  return {
    comparativa,
    loading,
    loadedData,
    fetchComparativa,
  };
}
