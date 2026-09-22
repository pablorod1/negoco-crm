"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type AbarcaSyncStatus =
  | "not_applicable"
  | "pending"
  | "syncing"
  | "synced"
  | "attention";

export interface AbarcaUserSyncStatus {
  user_id: string;
  name: string;
  abarca_user_id: number | null;
  status: AbarcaSyncStatus;
  desired_revision?: number | null;
  confirmed_revision?: number | null;
  attempts?: number | null;
  next_attempt_at?: string | null;
  last_error?: string | null;
  last_warnings?: string | null;
  last_confirmed_at?: string | null;
}

/**
 * Estado de la sincronización de comisiones con el Comparador por colaborador.
 * Alimenta tanto el badge del toggle Listado/Comisiones como el panel de
 * discrepancias dentro de la vista de comisiones.
 */
export function useAbarcaSyncStatuses(enabled: boolean) {
  const [statuses, setStatuses] = useState<AbarcaUserSyncStatus[]>([]);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const res = await fetch("/api/v2/commissions/abarca/status");
      const data = await res.json();
      if (!res.ok || !data.success) return;
      setStatuses(Array.isArray(data.data) ? data.data : []);
    } catch {
      // El badge es informativo; un fallo aquí no debe romper la página.
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  const verify = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const res = await fetch("/api/v2/commissions/abarca/check", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.success) return;
      setStatuses(Array.isArray(data.data) ? data.data : []);
    } catch {
      // La última comprobación persistida sigue disponible mediante `refetch`.
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    queueMicrotask(async () => {
      await refetch();
      await verify();
    });
  }, [refetch, verify]);

  const issues = useMemo(
    () =>
      statuses.filter((status) =>
        status.status === "attention" || status.status === "pending",
      ),
    [statuses],
  );

  return {
    statuses,
    issues,
    issueCount: issues.length,
    loading,
    refetch,
    verify,
  };
}
