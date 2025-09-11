import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTransitionRouter } from "next-view-transitions";
import { CloudAlert, ShieldAlert } from "lucide-react";
import { EditTramiteFormData } from "@/tramites/types/tramite.types";
import { createEmptyTramiteForm } from "@/tramites/utils/tramite.factories";
import { SignerDB } from "@/tramites/types/tramite.types";
import { User } from "@/core/types";
import { showCustomToast } from "@/core/components/CustomToast";

interface UseTramiteDetailsParams {
  userData: User | null;
}

export function useTramiteDetails({ userData }: UseTramiteDetailsParams) {
  const { id } = useParams();
  const router = useTransitionRouter();
  const [formData, setFormData] = useState<EditTramiteFormData>(
    createEmptyTramiteForm()
  );
  const [loading, setLoading] = useState(true);
  const [loadedData, setLoadedData] = useState(false);

  const fetchTramite = useCallback(async () => {
    if (!userData?.id || !userData?.role) return;

    try {
      const rs = await fetch(`/api/v2/contracts/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          user_id: userData.id,
          role: userData.role,
        }),
      });

      // Comprobar primero el estado HTTP de la respuesta
      if (rs.status === 403) {
        showCustomToast({
          title: "Acceso denegado",
          message: "No tienes permiso para acceder a este trámite",
          icon: ShieldAlert,
          iconSize: 24,
          iconColor: "var(--danger-color)",
        });
        router.push("/tramites");
        return;
      }

      if (!rs.ok) {
        const errorData = await rs.json();
        showCustomToast({
          title: "Error",
          message: errorData.error || "Error al cargar el trámite",
          icon: CloudAlert,
          iconSize: 24,
          iconColor: "var(--danger-color)",
        });
        router.push("/tramites");
        return;
      }

      const { success, data } = await rs.json();
      console.log("Datos del trámite recibidos:", data);
      if (success && data) {
        setFormData({
          ...data,
          signer: data.signer || ({} as SignerDB),
        });
        setLoadedData(true);
      } else {
        // Si no hay datos pero la respuesta fue exitosa (caso extraño), redirigir de todas formas
        showCustomToast({
          title: "Error",
          message: "No se encontraron datos del trámite",
          icon: CloudAlert,
          iconSize: 24,
          iconColor: "var(--danger-color)",
        });
        router.push("/tramites");
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
      router.push("/tramites");
      return;
    } finally {
      setLoading(false);
    }
  }, [id, userData?.id, userData?.role, router]);

  useEffect(() => {
    fetchTramite();
  }, [fetchTramite]);

  return {
    formData,
    loading,
    loadedData,
    fetchTramite,
    tramiteId: id as string,
  };
}
