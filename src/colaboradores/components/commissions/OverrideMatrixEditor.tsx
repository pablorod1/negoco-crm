"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Search, TriangleAlert, Users, X } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { Checkbox } from "@/core/components/ui/checkbox";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/core/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/core/components/ui/select";
import { showCustomToast } from "@/core/components/CustomToast";
import { cn } from "@/core/utils";
import type { ComercializadoraVM } from "@/comercializadoras/types";
import type {
  CommissionSegment,
  CommissionType,
  DefaultCompanyCommission,
  User,
  UserCompanyCommission,
} from "@/core/types";
import { COMMISSION_SEGMENT_LABELS } from "@/core/utils/commission-segment";

type ApplyMode = "overwrite" | "only_missing" | "inherit";

const applyModes: { value: ApplyMode; label: string; hint: string }[] = [
  {
    value: "overwrite",
    label: "Sobrescribir",
    hint: "Crea o sustituye las personalizaciones existentes.",
  },
  {
    value: "only_missing",
    label: "Solo sin personalizar",
    hint: "Respeta las personalizaciones que ya existan.",
  },
  {
    value: "inherit",
    label: "Volver a heredar",
    hint: "Elimina la personalización y usa el valor por defecto.",
  },
];

interface Props {
  users: User[];
  suppliers: ComercializadoraVM[];
  defaults: DefaultCompanyCommission[];
  overrides: UserCompanyCommission[];
  segments: CommissionSegment[];
  loading: boolean;
  onRefetch: () => Promise<void> | void;
}

function commissionLabel(
  commission: Pick<UserCompanyCommission, "commission_type" | "commission_value">,
) {
  return `${commission.commission_value}${
    commission.commission_type === "percent" ? "%" : " €"
  }`;
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

interface CellProps {
  user: User;
  supplier: ComercializadoraVM;
  entries: { segment: CommissionSegment; fallback?: DefaultCompanyCommission; override?: UserCompanyCommission }[];
  disabled: boolean;
  onChanged: () => Promise<void> | void;
}

function CommissionCell({
  user,
  supplier,
  entries,
  disabled,
  onChanged,
}: CellProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState<CommissionType>("percent");
  const [value, setValue] = useState("");
  const effective = entries.map((entry) => entry.override ?? entry.fallback);
  const first = effective[0];
  const mixed = effective.some((rule) => rule?.commission_type !== first?.commission_type || rule?.commission_value !== first?.commission_value);
  const hasOverride = entries.some((entry) => entry.override);
  const allPersonalized = entries.every((entry) => entry.override);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setType(first?.commission_type ?? "percent");
      setValue(mixed ? "" : String(first?.commission_value ?? ""));
    }
    setOpen(nextOpen);
  };

  const persist = async (nextOverride: boolean) => {
    if (nextOverride && !canSave) return;
    setSaving(true);
    try {
      const response = await fetch("/api/v2/commissions/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_ids: [user.id],
          comercializadora_ids: [supplier.id],
          segments: entries.map((entry) => entry.segment),
          mode: nextOverride ? "overwrite" : "inherit",
          ...(nextOverride ? { commission_type: type, commission_value: Number(value) } : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "No se pudo guardar la comisión");
      }

      await onChanged();
      setOpen(false);
      showCustomToast({
        title: nextOverride ? "Comisión personalizada" : "Comisión heredada",
        message: `${user.name} · ${supplier.name}`,
        icon: Check,
        iconColor: "green",
        iconSize: 24,
      });
    } catch (error) {
      showCustomToast({
        title: "Error al guardar",
        message: error instanceof Error ? error.message : "Error desconocido",
        icon: TriangleAlert,
        iconColor: "red",
        iconSize: 24,
      });
    } finally {
      setSaving(false);
    }
  };

  const canSave = value.trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= 0 && !saving;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "group min-w-[92px] rounded-xl border px-2.5 py-2 text-left transition-colors",
            hasOverride
              ? "border-blue-200 bg-blue-50 hover:bg-blue-100"
              : "border-transparent bg-gray-50 hover:border-gray-200 hover:bg-gray-100",
          )}
          title={`${user.name} · ${supplier.name}`}
        >
          <span
            className={cn(
              "block text-sm font-medium",
              hasOverride ? "text-blue-700" : "text-gray-600",
            )}
          >
            {mixed ? "Valores distintos" : first ? commissionLabel(first) : "—"}
          </span>
          <span className={cn("block text-[11px]", hasOverride ? "text-blue-500" : "text-gray-400")}>
            {allPersonalized ? "Personalizada" : hasOverride ? "Origen mixto" : first || mixed ? "Por defecto" : "Sin definir"}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-72 space-y-4">
        <div>
          <p className="font-medium text-sm text-gray-900">{user.name}</p>
          <p className="text-xs text-gray-500">
            {supplier.name}
          </p>
        </div>
        <ul className="space-y-1 text-xs text-gray-600">
          {entries.map((entry) => <li key={entry.segment}>{COMMISSION_SEGMENT_LABELS[entry.segment]}: {entry.override || entry.fallback ? commissionLabel((entry.override ?? entry.fallback)!) : "Sin definir"} · {entry.override ? "Personalizada" : "Por defecto"}</li>)}
        </ul>
        <p className="text-xs text-gray-500">{entries.length > 1 ? "El nuevo valor se guardará en todos estos segmentos." : "El cambio se guarda al pulsar Guardar."}</p>
        <div className="grid grid-cols-[110px_1fr] gap-2">
          <Select
            value={type}
            onValueChange={(next: CommissionType) => setType(next)}
            disabled={saving}
          >
            <SelectTrigger aria-label="Tipo de comisión personalizada">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percent">%</SelectItem>
              <SelectItem value="fixed">Fijo</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="number"
            aria-label="Valor de comisión personalizada"
            min={0}
            step={0.01}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Valor"
            disabled={saving}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          {hasOverride ? (
            <Button
              size="sm"
              variant="ghost"
              className="text-gray-500 hover:text-red-600"
              onClick={() => persist(false)}
              disabled={saving}
            >
              <X size={14} className="mr-1.5" />
              Usar defecto
            </Button>
          ) : (
            <span className="text-xs text-gray-400">Crea una personalización</span>
          )}
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => persist(true)}
            disabled={!canSave}
          >
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function OverrideMatrixEditor({
  users,
  suppliers,
  defaults,
  overrides,
  segments,
  loading,
  onRefetch,
}: Props) {
  const [search, setSearch] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>([]);
  const [mode, setMode] = useState<ApplyMode>("overwrite");
  const [commissionType, setCommissionType] =
    useState<CommissionType>("percent");
  const [commissionValue, setCommissionValue] = useState("");
  const [applying, setApplying] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(true);

  const comerciales = useMemo(
    () => users.filter((user) => user.role === "2" && !user.banned),
    [users],
  );
  const visibleUsers = useMemo(() => {
    const term = normalizeText(search.trim());
    return comerciales.filter(
      (user) =>
        !term ||
        normalizeText(user.name).includes(term) ||
        normalizeText(user.email).includes(term),
    );
  }, [comerciales, search]);
  const defaultsMap = useMemo(
    () =>
      new Map(
        defaults.map((commission) => [
          `${commission.comercializadora_id}:${commission.segment}`,
          commission,
        ]),
      ),
    [defaults],
  );
  const overridesMap = useMemo(
    () =>
      new Map(
        overrides.map((commission) => [
          `${commission.user_id}:${commission.comercializadora_id}:${commission.segment}`,
          commission,
        ]),
      ),
    [overrides],
  );

  const allVisibleSelected =
    visibleUsers.length > 0 &&
    visibleUsers.every((user) => selectedUserIds.includes(user.id));

  const toggleUser = (userId: string) => {
    setSelectedUserIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    );
  };
  const toggleAllVisible = () => {
    const visibleIds = visibleUsers.map((user) => user.id);
    setSelectedUserIds((current) =>
      allVisibleSelected
        ? current.filter((id) => !visibleIds.includes(id))
        : Array.from(new Set([...current, ...visibleIds])),
    );
  };
  const toggleSupplier = (supplierId: string) => {
    setSelectedSupplierIds((current) =>
      current.includes(supplierId)
        ? current.filter((id) => id !== supplierId)
        : [...current, supplierId],
    );
  };

  const applyBulk = async () => {
    setApplying(true);
    try {
      const response = await fetch("/api/v2/commissions/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_ids: selectedUserIds,
          comercializadora_ids: selectedSupplierIds,
          segments,
          mode,
          ...(mode !== "inherit"
            ? {
                commission_type: commissionType,
                commission_value: Number(commissionValue) || 0,
              }
            : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "No se pudieron aplicar las comisiones");
      }
      await onRefetch();
      setSelectedUserIds([]);
      setSelectedSupplierIds([]);
      setCommissionValue("");
      showCustomToast({
        title: "Comisiones aplicadas",
        message: `${result.data.updated_users} colaboradores actualizados en ${result.data.updated_companies} comercializadoras`,
        icon: Check,
        iconColor: "green",
        iconSize: 24,
      });
    } catch (error) {
      showCustomToast({
        title: "Error al aplicar comisiones",
        message: error instanceof Error ? error.message : "Error desconocido",
        icon: TriangleAlert,
        iconColor: "red",
        iconSize: 24,
      });
    } finally {
      setApplying(false);
    }
  };

  const canApply =
    selectedUserIds.length > 0 &&
    selectedSupplierIds.length > 0 &&
    (mode === "inherit" || (commissionValue.trim() !== "" && Number.isFinite(Number(commissionValue)) && Number(commissionValue) >= 0)) &&
    !loading &&
    !applying;

  return (
    <section className="overflow-hidden">
      <div className="p-5 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">
              Comisiones por colaborador
            </h3>
            <p className="text-sm text-gray-500">
              Pulsa una comisión para editarla o marca colaboradores para aplicar cambios en bloque.
              Las personalizaciones sustituyen el valor por defecto.
            </p>
          </div>
          <div className="relative shrink-0">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <Input
              type="search"
              aria-label="Buscar colaborador"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar colaborador"
              className="h-9 w-full pl-9 sm:w-64"
            />
          </div>
        </div>

        {selectedUserIds.length > 0 && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50/60 overflow-hidden">
            <button
              type="button"
               onClick={() => setBulkOpen((current) => !current)}
               aria-expanded={bulkOpen}
              className="flex w-full items-center gap-3 px-4 py-3 text-left"
            >
              <Users size={17} className="text-blue-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900">
                  Aplicar en bloque a {selectedUserIds.length} colaboradores
                </p>
                <p className="text-xs text-blue-700">
                  {segments.map((segment) => COMMISSION_SEGMENT_LABELS[segment]).join(" · ")}
                </p>
              </div>
              <ChevronDown
                size={16}
                className={cn(
                  "text-blue-600 transition-transform",
                  !bulkOpen && "-rotate-90",
                )}
              />
            </button>
            {bulkOpen && (
              <div className="border-t border-blue-200 bg-white p-4 space-y-4">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                  {applyModes.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={mode === option.value}
                      disabled={applying}
                      onClick={() => setMode(option.value)}
                      className={cn(
                        "rounded-xl border p-3 text-left transition-colors",
                        mode === option.value
                          ? "border-blue-300 bg-blue-50"
                          : "border-gray-200 hover:bg-gray-50",
                      )}
                    >
                      <span className="block text-sm font-medium text-gray-900">
                        {option.label}
                      </span>
                      <span className="mt-0.5 block text-xs text-gray-500">
                        {option.hint}
                      </span>
                    </button>
                  ))}
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <Label>Comercializadoras</Label>
                    <button
                      type="button"
                      className="text-xs font-medium text-blue-600 hover:text-blue-700"
                      disabled={applying}
                      onClick={() =>
                        setSelectedSupplierIds(
                          selectedSupplierIds.length === suppliers.length
                            ? []
                            : suppliers.map((supplier) => supplier.id),
                        )
                      }
                    >
                      {selectedSupplierIds.length === suppliers.length
                        ? "Quitar todas"
                        : "Seleccionar todas"}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {suppliers.map((supplier) => {
                      const selected = selectedSupplierIds.includes(supplier.id);
                      return (
                        <button
                          key={supplier.id}
                          type="button"
                          aria-pressed={selected}
                          disabled={applying}
                          onClick={() => toggleSupplier(supplier.id)}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-sm transition-colors",
                            selected
                              ? "border-blue-200 bg-blue-50 text-blue-700"
                              : "border-gray-200 text-gray-600 hover:bg-gray-50",
                          )}
                        >
                          {supplier.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  {mode !== "inherit" ? (
                    <div className="grid grid-cols-[120px_160px] gap-2">
                      <div className="space-y-1.5">
                        <Label>Tipo</Label>
                        <Select
                          value={commissionType}
                          disabled={applying}
                          onValueChange={(next: CommissionType) =>
                            setCommissionType(next)
                          }
                        >
                          <SelectTrigger aria-label="Tipo de comisión en bloque"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percent">%</SelectItem>
                            <SelectItem value="fixed">Fijo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Valor</Label>
                        <Input
                           type="number"
                           aria-label="Valor de comisión en bloque"
                           disabled={applying}
                          min={0}
                          step={0.01}
                          value={commissionValue}
                          onChange={(event) => setCommissionValue(event.target.value)}
                          placeholder="Ej. 15"
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">
                      Se eliminarán las personalizaciones seleccionadas y se usarán las comisiones por defecto.
                    </p>
                  )}
                  <Button
                    className="bg-blue-600 text-white hover:bg-blue-700"
                    disabled={!canApply}
                    onClick={applyBulk}
                  >
                    {applying ? "Aplicando..." : "Aplicar comisiones"}
                  </Button>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3 text-xs text-gray-600">
                  <p>{selectedUserIds.length} colaboradores × {selectedSupplierIds.length} comercializadoras × {segments.length} segmentos. Se guarda al aplicar.</p>
                  <button type="button" disabled={applying} onClick={() => setSelectedUserIds([])} className="font-medium text-blue-600">Limpiar selección</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="border-t border-gray-100 py-12 text-center text-sm text-gray-500">
          Cargando comisiones...
        </div>
      ) : suppliers.length === 0 ? (
        <p className="p-8 text-center text-sm text-gray-500">No hay comercializadoras activas.</p>
      ) : visibleUsers.length === 0 ? (
        <div className="border-t border-gray-100 py-12 text-center text-sm text-gray-500">
          {comerciales.length === 0 ? "No hay colaboradores activos para configurar." : "No hay colaboradores que coincidan con la búsqueda."}
        </div>
      ) : (
        <div className="max-h-[65vh] overflow-auto border-t border-gray-200">
          <table className="min-w-full border-collapse">
            <thead className="sticky top-0 z-20 bg-gray-50">
              <tr>
                <th className="sticky left-0 z-20 min-w-[230px] border-b border-r border-gray-200 bg-gray-50 px-4 py-3 text-left">
                  <label className="flex cursor-pointer items-center gap-3">
                    <Checkbox
                      checked={allVisibleSelected ? true : visibleUsers.some((user) => selectedUserIds.includes(user.id)) ? "indeterminate" : false}
                      disabled={applying}
                      onCheckedChange={toggleAllVisible}
                    />
                    <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
                      Colaborador
                    </span>
                  </label>
                </th>
                {suppliers.map((supplier) => (
                  <th
                    key={supplier.id}
                    className="min-w-[120px] border-b border-gray-200 px-3 py-3 text-left text-xs font-medium text-gray-500"
                    title={supplier.name}
                  >
                    <span className="block max-w-[130px] truncate">
                      {supplier.name}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visibleUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50/60">
                  <td className="sticky left-0 z-10 border-r border-gray-100 bg-white px-4 py-3">
                    <label className="flex cursor-pointer items-center gap-3">
                      <Checkbox
                        checked={selectedUserIds.includes(user.id)}
                        disabled={applying}
                        onCheckedChange={() => toggleUser(user.id)}
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-gray-900">
                          {user.name}
                        </span>
                        <span className="block truncate text-xs text-gray-400">
                          {user.email}
                        </span>
                      </span>
                    </label>
                  </td>
                  {suppliers.map((supplier) => (
                    <td key={supplier.id} className="px-3 py-2.5">
                      <CommissionCell
                        key={segments.join(":")}
                        user={user}
                        supplier={supplier}
                        entries={segments.map((segment) => ({
                          segment,
                          fallback: defaultsMap.get(`${supplier.id}:${segment}`),
                          override: overridesMap.get(`${user.id}:${supplier.id}:${segment}`),
                        }))}
                        disabled={applying}
                        onChanged={onRefetch}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
