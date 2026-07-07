"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/core/components/ui/select";
import { Switch } from "@/core/components/ui/switch";
import { showCustomToast } from "@/core/components/CustomToast";
import SettingsCard from "@/perfil/components/SettingsCard";
import type { CrmSettings, DelayUnit } from "@/crm-settings/types";
import type { CrmSettingsPayload } from "@/crm-settings/server";
import { CircleCheck, CircleX, Save, Zap } from "lucide-react";

const unitOptions: Array<{ value: DelayUnit; label: string }> = [
  { value: "minutes", label: "Minutos" },
  { value: "hours", label: "Horas" },
  { value: "days", label: "Días" },
];

interface Props {
  settings: CrmSettings | null;
  saveSettings: (payload: CrmSettingsPayload) => Promise<CrmSettings>;
}

export default function AutoActivationSettings({
  settings,
  saveSettings,
}: Props) {
  const [enabled, setEnabled] = useState(false);
  const [delayValue, setDelayValue] = useState(0);
  const [delayUnit, setDelayUnit] = useState<DelayUnit>("days");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setEnabled(settings.processing_auto_activation.enabled);
    setDelayValue(settings.processing_auto_activation.delay_value);
    setDelayUnit(settings.processing_auto_activation.delay_unit);
  }, [settings]);

  const hasChanges = useMemo(() => {
    if (!settings) return false;
    const current = settings.processing_auto_activation;
    return (
      current.enabled !== enabled ||
      current.delay_value !== delayValue ||
      current.delay_unit !== delayUnit
    );
  }, [settings, enabled, delayValue, delayUnit]);

  const handleSave = async () => {
    setSaving(true);

    try {
      await saveSettings({
        processing_auto_activation: {
          enabled,
          delay_value: delayValue,
          delay_unit: delayUnit,
        },
      });
      showCustomToast({
        title: "Automatización guardada",
        message: "La activación automática se ha actualizado correctamente.",
        icon: CircleCheck,
        iconSize: 24,
        iconColor: "var(--success-color)",
      });
    } catch (saveError) {
      showCustomToast({
        title: "Error al guardar",
        message:
          saveError instanceof Error
            ? saveError.message
            : "No se pudo guardar la automatización.",
        icon: CircleX,
        iconSize: 24,
        iconColor: "var(--danger-color)",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsCard
      title="Activación automática"
      description="Paso automático de trámites de «Procesando» a «Activo» tras un tiempo."
      icon={<Zap className="size-5" />}
      bodyClassName="space-y-6"
    >
      <div className="flex items-center justify-between gap-4 rounded-xl bg-gray-50 px-4 py-3">
        <div className="space-y-0.5">
          <Label htmlFor="crm-auto-activation" className="text-sm font-medium">
            Activación automática
          </Label>
          <p className="text-xs text-gray-500">
            {enabled
              ? "Los trámites pasarán a «Activo» automáticamente."
              : "El paso a «Activo» se hace manualmente."}
          </p>
        </div>
        <Switch
          id="crm-auto-activation"
          checked={enabled}
          onCheckedChange={setEnabled}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
        <div className="space-y-2">
          <Label htmlFor="crm-delay-value">Tiempo de espera</Label>
          <Input
            id="crm-delay-value"
            type="number"
            min={0}
            value={delayValue}
            onChange={(event) =>
              setDelayValue(Math.max(0, Number(event.target.value) || 0))
            }
            disabled={!enabled}
            className="h-10 rounded-xl"
          />
        </div>

        <div className="space-y-2">
          <Label>Unidad</Label>
          <Select
            value={delayUnit}
            onValueChange={(value) => setDelayUnit(value as DelayUnit)}
            disabled={!enabled}
          >
            <SelectTrigger className="h-10 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {unitOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-5">
        <span className="flex items-center gap-2 text-sm text-gray-500">
          {hasChanges ? (
            <>
              <span className="size-2 rounded-full bg-orange-400" />
              Tienes cambios sin guardar
            </>
          ) : (
            <>
              <span className="size-2 rounded-full bg-green-400" />
              Todo actualizado
            </>
          )}
        </span>
        <Button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className="rounded-xl bg-gray-900 px-6 text-white hover:bg-gray-800"
          size="sm"
        >
          <Save className="mr-2 size-4" />
          {saving ? "Guardando..." : "Guardar"}
        </Button>
      </div>
    </SettingsCard>
  );
}
