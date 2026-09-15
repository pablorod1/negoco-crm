"use client";

import { useCallback, useEffect, useState } from "react";
import type { CrmSettings } from "@/crm-settings/types";
import type { CrmSettingsPayload } from "@/crm-settings/server";

interface CrmSettingsResponse {
  success: boolean;
  data?: CrmSettings;
  error?: string;
}

export function useCrmSettings({ enabled = true }: { enabled?: boolean } = {}) {
  const [settings, setSettings] = useState<CrmSettings | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/v2/crm-settings");
      const result = (await response.json()) as CrmSettingsResponse;

      if (!result.success || !result.data) {
        throw new Error(result.error || "No se pudo cargar la configuración");
      }

      setSettings(result.data);
      return result.data;
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "No se pudo cargar la configuración";
      setError(message);
      setSettings(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const saveSettings = useCallback(async (payload: CrmSettingsPayload) => {
    setError(null);

    const response = await fetch("/api/v2/crm-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = (await response.json()) as CrmSettingsResponse;

    if (!result.success || !result.data) {
      const message = result.error || "No se pudo guardar la configuración";
      setError(message);
      throw new Error(message);
    }

    setSettings(result.data);
    return result.data;
  }, []);

  return {
    settings,
    loading,
    error,
    refetch: fetchSettings,
    saveSettings,
  };
}
