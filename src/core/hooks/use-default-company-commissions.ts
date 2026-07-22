"use client";

import { useCallback, useEffect, useState } from "react";
import { DefaultCompanyCommission } from "@/core/types";

/**
 * Comisiones por defecto de la asesoría (comunes a todos los colaboradores).
 * Un colaborador las hereda salvo que tenga override propio.
 */
export function useDefaultCompanyCommissions(enabled = true) {
  const [defaults, setDefaults] = useState<DefaultCompanyCommission[]>([]);
  // Arranca en carga: mientras el consumidor esté deshabilitado no debe leer
  // una lista vacía como si fuese "no hay comisiones por defecto".
  const [loading, setLoading] = useState(true);

  const fetchDefaults = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/v2/commissions/defaults");
      const result = await response.json();
      setDefaults(result.success ? (result.data ?? []) : []);
    } catch (error) {
      console.error("Error fetching default company commissions:", error);
      setDefaults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    fetchDefaults();
  }, [enabled, fetchDefaults]);

  return { defaults, loading, refetch: fetchDefaults };
}
