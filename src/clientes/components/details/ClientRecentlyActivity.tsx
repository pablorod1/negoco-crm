"use client";

import { showCustomToast } from "@/core/components/CustomToast";
import LoadingStateCard from "@/dashboard/components/LoadingStateCard";
import { formatDateTime } from "@/core/utils/format";
import type { LiquidezStatus, Status } from "@/core/types";
import type { TramiteVM } from "@/tramites/types/tramite.types";
import {
  CloudIcon as CloudAlert,
  Calendar,
  User,
  ArrowRight,
  RefreshCcw,
  AlertTriangle,
  ActivityIcon,
} from "lucide-react";
import { useEffect, useState, useCallback, memo } from "react";
import { getStatusBadge } from "@/core/hooks/use-status-badge";
import Link from "next/link";
import ClientDetailCard from "./ClientDetailCard";

interface Props {
  client_id: string;
}

// Custom hook to fetch last tramite
function useLastTramite(clientId: string) {
  const [state, setState] = useState<{
    lastTramite: TramiteVM | null;
    loading: boolean;
    error: string | null;
  }>({
    lastTramite: null,
    loading: true,
    error: null,
  });

  const fetchLastTramite = useCallback(async () => {
    if (!clientId) return;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const res = await fetch(`/api/clients/get/${clientId}/last-tramite`, {
        method: "POST",
      });

      const { success, error, data } = await res.json();

      if (!success) {
        console.error("Error fetching last tramite:", error);
        setState((prev) => ({
          ...prev,
          loading: false,
          error: "No se pudo cargar el trámite más reciente",
        }));

        showCustomToast({
          title: "Error al cargar el trámite",
          message: "No se pudo cargar el trámite más reciente",
          icon: CloudAlert,
          iconColor: "var(--danger-color)",
          iconSize: 24,
        });
        return;
      }

      setState({
        lastTramite: data || null,
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error("Error fetching last tramite:", error);
      setState((prev) => ({
        ...prev,
        loading: false,
        error: "Error en el servidor",
      }));

      showCustomToast({
        title: "Error en el servidor",
        message: "No se pudo cargar el trámite más reciente",
        icon: CloudAlert,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
    }
  }, [clientId]);

  useEffect(() => {
    fetchLastTramite();
  }, [fetchLastTramite]);

  return { ...state, refetch: fetchLastTramite };
}

// Memo-ized component for activity details
const TramiteDetails = memo(({ tramite }: { tramite: TramiteVM }) => (
  <div className="flex flex-col gap-4">
    {/* ID y Estado */}
    <div className="flex justify-between items-center pb-2 border-b">
      <div>
        <p className="text-xs font-medium text-muted-foreground">Trámite ID</p>
        <p className="text-base font-semibold">{tramite.id}</p>
      </div>
      <div className="flex items-center gap-2">
        {getStatusBadge(tramite.status as Status, "general")}
        {tramite.liquidez_status &&
          getStatusBadge(tramite.liquidez_status as LiquidezStatus, "liquidez")}
      </div>
    </div>

    {/* Fechas */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-primary" />
        <div>
          <p className="text-xs font-medium text-muted-foreground">Creado</p>
          <p className="text-sm font-medium">
            {formatDateTime(tramite.creation_date)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-primary" />
        <div>
          <p className="text-xs font-medium text-muted-foreground">Activado</p>
          <p className="text-sm font-medium">
            {tramite.activation_date ? (
              formatDateTime(tramite.activation_date)
            ) : (
              <span className="italic text-muted-foreground">Pendiente</span>
            )}
          </p>
        </div>
      </div>
    </div>

    {/* Comercial asignado */}
    <div className="flex items-center gap-2">
      <User className="h-4 w-4 text-primary" />
      <div>
        <p className="text-xs font-medium text-muted-foreground">Comercial</p>
        <p className="text-sm font-medium">
          {tramite.sales_name || (
            <span className="italic text-muted-foreground">No asignado</span>
          )}
        </p>
      </div>
    </div>

    {/* Última actualización */}
    <div className="flex items-center gap-2">
      <RefreshCcw className="h-4 w-4 text-primary" />
      <div>
        <p className="text-xs font-medium text-muted-foreground">
          Última actualización
        </p>
        {tramite.updated_at && tramite.updated_by ? (
          <p className="text-sm font-medium">
            {formatDateTime(tramite.updated_at)} por{" "}
            <span className="font-medium text-primary/80">
              {tramite.updated_by.name || tramite.updated_by.email}
            </span>
          </p>
        ) : (
          <p className="text-sm italic text-muted-foreground">
            Sin actualizaciones
          </p>
        )}
      </div>
    </div>

    {/* Botón */}
    <div className="flex justify-end mt-2">
      <Link
        href={`/tramites/${tramite.id}`}
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-white text-sm font-medium hover:bg-primary-700 transition-colors"
      >
        Ver trámite
        <ArrowRight className="w-4 h-4 ml-1" />
      </Link>
    </div>
  </div>
));

TramiteDetails.displayName = "TramiteDetails";

// Error state component
const ErrorState = ({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) => (
  <div className="flex flex-col items-center justify-center py-4 space-y-3">
    <AlertTriangle className="h-10 w-10 text-amber-500" />
    <p className="text-sm text-muted-foreground text-center">{message}</p>
    <button
      onClick={onRetry}
      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
    >
      <RefreshCcw className="w-3 h-3 mr-1" />
      Reintentar
    </button>
  </div>
);

export default function ClientRecentlyActivity({ client_id }: Props) {
  const { lastTramite, loading, error, refetch } = useLastTramite(client_id);

  return (
    <ClientDetailCard title="Actividad Reciente" icon={ActivityIcon}>
      {loading ? (
        <LoadingStateCard />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : (
        <div className="space-y-4">
          {lastTramite ? (
            <TramiteDetails tramite={lastTramite} />
          ) : (
            <div className="flex flex-col items-center justify-center py-6 space-y-2">
              <RefreshCcw className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground text-center">
                No hay actividad reciente para este cliente
              </p>
            </div>
          )}
        </div>
      )}
    </ClientDetailCard>
  );
}
