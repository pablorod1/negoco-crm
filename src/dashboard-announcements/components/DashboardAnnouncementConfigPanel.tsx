"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/core/components/ui/badge";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Textarea } from "@/core/components/ui/textarea";
import { Skeleton } from "@/core/components/ui/skeleton";
import { showCustomToast } from "@/core/components/CustomToast";
import { cn } from "@/core/utils";
import { formatDateTime } from "@/core/utils/format";
import type {
  ApiResponse,
  DashboardAnnouncement,
  DashboardAnnouncementVariant,
} from "@/dashboard-announcements/types";
import { variantConfig, variantOrder } from "@/dashboard-announcements/variants";
import AnnouncementCard from "@/dashboard-announcements/components/AnnouncementCard";
import {
  CircleCheck,
  CircleX,
  Eye,
  Link2,
  Loader2,
  Megaphone,
  MousePointerClick,
  Save,
  Trash2,
} from "lucide-react";

const TITLE_MAX = 120;
const MESSAGE_MAX = 1200;
const CTA_LABEL_MAX = 60;
const CTA_URL_MAX = 500;

interface DashboardAnnouncementConfigPanelProps {
  initialAnnouncement?: DashboardAnnouncement | null;
  compact?: boolean;
  showStatus?: boolean;
  onSaved?: (announcement: DashboardAnnouncement) => void;
  onDeactivated?: () => void;
}

const emptyForm = {
  title: "",
  message: "",
  variant: "info" as DashboardAnnouncementVariant,
  cta_label: "",
  cta_url: "",
};

export default function DashboardAnnouncementConfigPanel({
  initialAnnouncement,
  compact = false,
  showStatus = true,
  onSaved,
  onDeactivated,
}: DashboardAnnouncementConfigPanelProps) {
  const shouldFetchActive = initialAnnouncement === undefined;
  const [activeAnnouncement, setActiveAnnouncement] =
    useState<DashboardAnnouncement | null>(initialAnnouncement || null);
  const [loading, setLoading] = useState(shouldFetchActive);
  const [saving, setSaving] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [formData, setFormData] = useState(emptyForm);

  const hydrateForm = useCallback(
    (announcement: DashboardAnnouncement | null) => {
      setFormData(
        announcement
          ? {
            title: announcement.title,
            message: announcement.message,
            variant: announcement.variant,
            cta_label: announcement.cta_label || "",
            cta_url: announcement.cta_url || "",
          }
          : emptyForm,
      );
    },
    [],
  );

  const fetchActiveAnnouncement = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/v2/dashboard-announcements/active");
      const result =
        (await response.json()) as ApiResponse<DashboardAnnouncement | null>;
      if (!result.success) {
        throw new Error(result.error || "Error al cargar el cartel");
      }
      setActiveAnnouncement(result.data || null);
      hydrateForm(result.data || null);
    } catch (error) {
      showCustomToast({
        title: "Error al cargar el cartel",
        message:
          error instanceof Error
            ? error.message
            : "Inténtalo de nuevo más tarde",
        icon: CircleX,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
    } finally {
      setLoading(false);
    }
  }, [hydrateForm]);

  useEffect(() => {
    if (shouldFetchActive) {
      fetchActiveAnnouncement();
    }
  }, [fetchActiveAnnouncement, shouldFetchActive]);

  useEffect(() => {
    if (!shouldFetchActive) {
      setActiveAnnouncement(initialAnnouncement || null);
      hydrateForm(initialAnnouncement || null);
      setLoading(false);
    }
  }, [hydrateForm, initialAnnouncement, shouldFetchActive]);

  const isDirty = useMemo(() => {
    if (!activeAnnouncement) {
      return (
        formData.title.trim() !== "" ||
        formData.message.trim() !== "" ||
        formData.cta_label.trim() !== "" ||
        formData.cta_url.trim() !== "" ||
        formData.variant !== emptyForm.variant
      );
    }
    return (
      formData.title !== activeAnnouncement.title ||
      formData.message !== activeAnnouncement.message ||
      formData.variant !== activeAnnouncement.variant ||
      formData.cta_label !== (activeAnnouncement.cta_label || "") ||
      formData.cta_url !== (activeAnnouncement.cta_url || "")
    );
  }, [formData, activeAnnouncement]);

  const ctaIncomplete =
    Boolean(formData.cta_label.trim()) !== Boolean(formData.cta_url.trim());

  const canSave =
    !saving &&
    formData.title.trim().length > 0 &&
    formData.message.trim().length > 0 &&
    !ctaIncomplete &&
    (!activeAnnouncement || isDirty);

  const updateField = <K extends keyof typeof emptyForm>(
    key: K,
    value: (typeof emptyForm)[K],
  ) => setFormData((current) => ({ ...current, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const endpoint = activeAnnouncement
        ? `/api/v2/dashboard-announcements/${activeAnnouncement.id}`
        : "/api/v2/dashboard-announcements";
      const method = activeAnnouncement ? "PATCH" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          cta_label: formData.cta_label || null,
          cta_url: formData.cta_url || null,
        }),
      });
      const result =
        (await response.json()) as ApiResponse<DashboardAnnouncement>;
      if (!result.success || !result.data) {
        throw new Error(result.error || "Error al guardar el cartel");
      }

      setActiveAnnouncement(result.data);
      hydrateForm(result.data);
      onSaved?.(result.data);
      showCustomToast({
        title: activeAnnouncement ? "Cartel actualizado" : "Cartel publicado",
        message: "El aviso ya aparece en el dashboard",
        icon: CircleCheck,
        iconColor: "var(--success-color)",
        iconSize: 24,
      });
    } catch (error) {
      showCustomToast({
        title: "Error al guardar",
        message:
          error instanceof Error
            ? error.message
            : "Inténtalo de nuevo más tarde",
        icon: CircleX,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!activeAnnouncement) return;

    setDeactivating(true);
    try {
      const response = await fetch(
        `/api/v2/dashboard-announcements/${activeAnnouncement.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_active: false }),
        },
      );
      const result =
        (await response.json()) as ApiResponse<DashboardAnnouncement>;
      if (!result.success) {
        throw new Error(result.error || "Error al retirar el cartel");
      }
      setActiveAnnouncement(null);
      hydrateForm(null);
      onDeactivated?.();
      showCustomToast({
        title: "Cartel retirado",
        message: "El aviso ya no se muestra en el dashboard",
        icon: CircleCheck,
        iconColor: "var(--success-color)",
        iconSize: 24,
      });
    } catch (error) {
      showCustomToast({
        title: "Error al retirar",
        message:
          error instanceof Error
            ? error.message
            : "Inténtalo de nuevo más tarde",
        icon: CircleX,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
    } finally {
      setDeactivating(false);
    }
  };

  if (loading) {
    return (
      <section
        className={cn(
          "rounded-2xl border border-gray-200 bg-white",
          compact ? "p-4" : "p-6",
        )}
      >
        <div className="flex items-center gap-3">
          <Skeleton className="size-11 rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-48 rounded-full" />
            <Skeleton className="h-3 w-64 rounded-full" />
          </div>
        </div>
        <Skeleton className="mt-6 h-40 w-full rounded-2xl" />
      </section>
    );
  }

  const fields = (
    <div className="space-y-5 ">
      {/* Tipo de aviso */}
      <div className="space-y-2">
        <Label>Tipo de aviso</Label>
        <div
          className={cn(
            "grid grid-cols-2 gap-2",
            !compact && "sm:grid-cols-4",
          )}
        >
          {variantOrder.map((value) => {
            const option = variantConfig[value];
            const OptionIcon = option.icon;
            const selected = formData.variant === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={selected}
                onClick={() => updateField("variant", value)}
                className={cn(
                  "flex flex-col overflow-hidden items-start gap-2 rounded-xl border p-3 text-left transition-colors",
                  selected ? option.pickerActive : option.pickerIdle,
                )}
              >
                <span
                  className={cn(
                    "flex size-8 items-center justify-center rounded-lg",
                    option.iconWrap,
                  )}
                >
                  <OptionIcon className="size-4" />
                </span>
                <span className="w-full min-w-0">
                  <span className="block truncate text-sm font-medium text-gray-900">
                    {option.label}
                  </span>
                  <span className="block truncate text-xs text-gray-500">
                    {option.hint}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div >

      {/* Título */}
      < div className="space-y-2" >
        <div className="flex items-center justify-between">
          <Label htmlFor="announcement-title">Título</Label>
          <span className="text-xs tabular-nums text-gray-400">
            {formData.title.length}/{TITLE_MAX}
          </span>
        </div>
        <Input
          id="announcement-title"
          value={formData.title}
          onChange={(event) => updateField("title", event.target.value)}
          maxLength={TITLE_MAX}
          placeholder="Ej. Mantenimiento programado el viernes"
        />
      </div >

      {/* Mensaje */}
      < div className="space-y-2" >
        <div className="flex items-center justify-between">
          <Label htmlFor="announcement-message">Mensaje</Label>
          <span className="text-xs tabular-nums text-gray-400">
            {formData.message.length}/{MESSAGE_MAX}
          </span>
        </div>
        <Textarea
          id="announcement-message"
          value={formData.message}
          onChange={(event) => updateField("message", event.target.value)}
          maxLength={MESSAGE_MAX}
          rows={compact ? 4 : 5}
          placeholder="Describe el aviso que verán todos los usuarios en su dashboard."
        />
      </div >

      {/* Llamada a la acción */}
      < div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50/60 p-4" >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
            <MousePointerClick className="size-4 text-gray-400" />
            Botón de acción
          </div>
          <Badge variant="default">Opcional</Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label
              htmlFor="announcement-cta-label"
              className="text-xs text-gray-500"
            >
              Texto del botón
            </Label>
            <Input
              id="announcement-cta-label"
              value={formData.cta_label}
              onChange={(event) => updateField("cta_label", event.target.value)}
              maxLength={CTA_LABEL_MAX}
              placeholder="Ver más"
            />
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor="announcement-cta-url"
              className="text-xs text-gray-500"
            >
              Enlace
            </Label>
            <div className="relative">
              <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
              <Input
                id="announcement-cta-url"
                value={formData.cta_url}
                onChange={(event) => updateField("cta_url", event.target.value)}
                maxLength={CTA_URL_MAX}
                placeholder="/tramites"
                className="pl-9"
              />
            </div>
          </div>
        </div>
        {
          ctaIncomplete ? (
            <p className="text-xs text-amber-600">
              Rellena el texto y el enlace para mostrar el botón.
            </p>
          ) : null
        }
      </div >
    </div >
  );

  const preview = (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/70 p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-400">
        <Eye className="size-3.5" />
        Vista previa en vivo
      </div>
      <AnnouncementCard
        variant={formData.variant}
        title={formData.title || "Título del cartel"}
        message={
          formData.message ||
          "Aquí aparecerá el mensaje que verán todos los usuarios en su dashboard."
        }
        ctaLabel={formData.cta_label}
        ctaUrl={formData.cta_url}
        preview
        className="bg-white/80 shadow-sm"
      />
    </div>
  );

  const footer = (
    <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-gray-400">
        {activeAnnouncement
          ? isDirty
            ? "Tienes cambios sin guardar."
            : showStatus
              ? `Última actualización: ${formatDateTime(activeAnnouncement.updated_at)}`
              : "El cartel está publicado."
          : "El cartel aún no se ha publicado."}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        {activeAnnouncement ? (
          <Button
            type="button"
            variant="outline"
            onClick={handleDeactivate}
            disabled={deactivating || saving}
          >
            {deactivating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            Retirar cartel
          </Button>
        ) : null}
        <Button type="button" onClick={handleSave} disabled={!canSave}>
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          {activeAnnouncement ? "Guardar cambios" : "Publicar cartel"}
        </Button>
      </div>
    </div>
  );

  return (
    <section
      className={cn(
        compact
          ? "space-y-5"
          : "rounded-2xl border border-gray-200 bg-white p-6",
      )}
    >
      {!compact ? (
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
              <Megaphone className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                Cartel del dashboard
              </h2>
              <p className="text-sm text-gray-500">
                Aviso destacado que verán todos los usuarios al entrar.
              </p>
            </div>
          </div>
          {showStatus ? (
            activeAnnouncement ? (
              <Badge variant="success">Activo</Badge>
            ) : (
              <Badge variant="default">Sin cartel</Badge>
            )
          ) : null}
        </div>
      ) : null}

      {compact ? (
        <div className="space-y-5">
          {fields}
          {preview}
          {footer}
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            {fields}
            {footer}
          </div>
          <aside className="lg:sticky lg:top-6 lg:self-start">{preview}</aside>
        </div>
      )}
    </section>
  );
}
