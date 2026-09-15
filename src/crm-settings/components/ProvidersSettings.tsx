"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/core/components/ui/badge";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { showCustomToast } from "@/core/components/CustomToast";
import SettingsCard from "@/perfil/components/SettingsCard";
import type { CrmSettings } from "@/crm-settings/types";
import type { CrmSettingsPayload } from "@/crm-settings/server";
import { Building2, CircleCheck, CircleX, Plus, Save, Trash2 } from "lucide-react";

interface Props {
  settings: CrmSettings | null;
  saveSettings: (payload: CrmSettingsPayload) => Promise<CrmSettings>;
}

export default function ProvidersSettings({ settings, saveSettings }: Props) {
  const [providers, setProviders] = useState<string[]>([]);
  const [newProvider, setNewProvider] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setProviders(settings.providers.map((provider) => provider.name));
  }, [settings]);

  const trimmedNewProvider = newProvider.trim();

  const hasChanges = useMemo(() => {
    if (!settings) return false;
    const current = settings.providers.map((provider) => provider.name);
    return JSON.stringify(current) !== JSON.stringify(providers);
  }, [providers, settings]);

  const addProvider = () => {
    if (!trimmedNewProvider) return;
    setProviders((current) => [...current, trimmedNewProvider]);
    setNewProvider("");
  };

  const removeProvider = (index: number) => {
    setProviders((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    );
  };

  const updateProvider = (index: number, value: string) => {
    setProviders((current) =>
      current.map((provider, itemIndex) =>
        itemIndex === index ? value : provider,
      ),
    );
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      await saveSettings({ providers });
      showCustomToast({
        title: "Proveedores guardados",
        message: "El listado de proveedores se ha actualizado correctamente.",
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
            : "No se pudo guardar el listado de proveedores.",
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
      title="Proveedores"
      description="Opciones disponibles al asignar la comercializadora en los trámites."
      icon={<Building2 className="size-5" />}
      action={
        <Badge variant={providers.length ? "secondary" : "outline"}>
          {providers.length} configurados
        </Badge>
      }
      bodyClassName="space-y-3"
    >
      {providers.length === 0 && (
        <p className="rounded-xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
          Aún no hay proveedores configurados. Añade el primero abajo.
        </p>
      )}

      {providers.map((provider, index) => (
        <div key={`${provider}-${index}`} className="flex items-center gap-2">
          <Input
            value={provider}
            onChange={(event) => updateProvider(index, event.target.value)}
            placeholder="Nombre del proveedor"
            className="h-10 rounded-xl"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => removeProvider(index)}
            aria-label="Eliminar proveedor"
            className="rounded-xl"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}

      <div className="flex items-center gap-2 pt-1">
        <Input
          value={newProvider}
          onChange={(event) => setNewProvider(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addProvider();
            }
          }}
          placeholder="Añadir proveedor"
          className="h-10 rounded-xl"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={addProvider}
          disabled={!trimmedNewProvider}
          aria-label="Añadir proveedor"
          className="rounded-xl"
        >
          <Plus className="size-4" />
        </Button>
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
