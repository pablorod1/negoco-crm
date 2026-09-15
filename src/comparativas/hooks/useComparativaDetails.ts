import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useParams } from "next/navigation";
import { useTransitionRouter } from "next-view-transitions";
import { CloudAlert, ShieldAlert } from "lucide-react";
import { ComparativaVM } from "@/comparativas/types";
import { User } from "@/core/types";
import { showCustomToast } from "@/core/components/CustomToast";

interface UseComparativaDetailsParams {
  userData: User | null;
}

interface LoadedComparativa {
  id: string;
  userId: string;
  userRole: string;
  data: ComparativaVM;
}

interface ActiveRequestContext {
  routeId: string;
  userId: string | undefined;
  userRole: string | undefined;
}

export function useComparativaDetails({
  userData,
}: UseComparativaDetailsParams) {
  const { id } = useParams<{ id: string }>();
  const router = useTransitionRouter();
  const userId = userData?.id;
  const userRole = userData?.role;
  const [loadedComparativa, setLoadedComparativa] =
    useState<LoadedComparativa | null>(null);
  const activeRequestContextRef =
    useRef<ActiveRequestContext | null>(null);
  const latestRequestRef = useRef(0);
  const loadedData =
    loadedComparativa?.id === id &&
    loadedComparativa.userId === userId &&
    loadedComparativa.userRole === userRole;
  const comparativa = loadedData ? loadedComparativa.data : null;

  useLayoutEffect(() => {
    const activeContext: ActiveRequestContext = {
      routeId: id,
      userId,
      userRole,
    };
    activeRequestContextRef.current = activeContext;

    return () => {
      if (activeRequestContextRef.current === activeContext) {
        activeRequestContextRef.current = null;
      }
    };
  }, [id, userId, userRole]);

  const fetchComparativa = useCallback(async () => {
    if (!userId || !userRole) return;

    const requestedId = id;
    const requestedUserId = userId;
    const requestedUserRole = userRole;
    const requestNumber = latestRequestRef.current + 1;
    latestRequestRef.current = requestNumber;
    const requestIsCurrent = () => {
      const activeContext = activeRequestContextRef.current;

      return (
        activeContext?.routeId === requestedId &&
        activeContext.userId === requestedUserId &&
        activeContext.userRole === requestedUserRole &&
        latestRequestRef.current === requestNumber
      );
    };

    try {
      const rs = await fetch(`/api/v2/comparisons/${requestedId}`, {
        method: "POST",
      });

      if (!requestIsCurrent()) return;

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
        if (!requestIsCurrent()) return;

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
      if (!requestIsCurrent()) return;

      if (success && data) {
        setLoadedComparativa({
          id: requestedId,
          userId: requestedUserId,
          userRole: requestedUserRole,
          data,
        });
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
      if (!requestIsCurrent()) return;

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
    }
  }, [id, userId, userRole, router]);

  useEffect(() => {
    // State changes only occur after the awaited comparison response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchComparativa();
  }, [fetchComparativa]);

  return {
    comparativa,
    loading: !loadedData,
    loadedData,
    fetchComparativa,
  };
}
