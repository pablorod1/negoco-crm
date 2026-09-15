"use client";

import { useMemo, useState } from "react";
import { Check, TriangleAlert, Users } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { Checkbox } from "@/core/components/ui/checkbox";
import { showCustomToast } from "@/core/components/CustomToast";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/core/components/ui/dialog";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/core/components/ui/select";
import { cn } from "@/core/utils";
import { CommissionType, User } from "@/core/types";
import { useActiveEnergySuppliers } from "@/comercializadoras/hooks/useActiveEnergySuppliers";

type ApplyMode = "overwrite" | "only_missing" | "inherit";

const ALL_TEAMS = "__all__";
const NO_TEAM = "__none__";

const applyModes: { value: ApplyMode; label: string; hint: string }[] = [
  {
    value: "overwrite",
    label: "Sobrescribir",
    hint: "Fija esta comisión a todos los seleccionados, tuvieran o no una personalizada.",
  },
  {
    value: "only_missing",
    label: "Solo a quien no la tenga",
    hint: "Respeta las comisiones personalizadas ya existentes.",
  },
  {
    value: "inherit",
    label: "Volver al valor por defecto",
    hint: "Elimina la comisión personalizada para que hereden la de la asesoría.",
  },
];

interface Props {
  users: User[];
  onApplied?: () => void;
}

/**
 * Aplica de una vez la misma comisión a varios comerciales, con filtro por
 * jefe de equipo. Evita tener que abrir la configuración colaborador a
 * colaborador cuando la asesoría trabaja con la misma comisión para todos.
 */
export default function BulkCommissionsModal({ users, onApplied }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [teamFilter, setTeamFilter] = useState(ALL_TEAMS);
  const [search, setSearch] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>([]);
  const [mode, setMode] = useState<ApplyMode>("overwrite");
  const [commissionType, setCommissionType] = useState<CommissionType>("percent");
  const [commissionValue, setCommissionValue] = useState("");

  const { activeSuppliers, loading: suppliersLoading } =
    useActiveEnergySuppliers();

  const comerciales = useMemo(
    () => users.filter((user) => user.role === "2" && !user.banned),
    [users],
  );

  const teams = useMemo(() => {
    const leadIds = new Set(
      comerciales
        .map((comercial) => comercial.super_id)
        .filter((superId): superId is string => Boolean(superId)),
    );
    return users
      .filter((user) => leadIds.has(user.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [comerciales, users]);

  const visibleUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return comerciales.filter((comercial) => {
      const matchesTeam =
        teamFilter === ALL_TEAMS ||
        (teamFilter === NO_TEAM
          ? !comercial.super_id
          : comercial.super_id === teamFilter);
      const matchesSearch =
        !term ||
        comercial.name.toLowerCase().includes(term) ||
        comercial.email.toLowerCase().includes(term);
      return matchesTeam && matchesSearch;
    });
  }, [comerciales, search, teamFilter]);

  const handleOpenChange = (open: boolean) => {
    // Cada apertura empieza limpia: una selección olvidada aplicaría comisiones
    // a colaboradores que no tocan.
    if (!open) {
      setTeamFilter(ALL_TEAMS);
      setSearch("");
      setSelectedUserIds([]);
      setSelectedSupplierIds([]);
      setMode("overwrite");
      setCommissionValue("");
    }
    setIsOpen(open);
  };

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

  const allSuppliersSelected =
    activeSuppliers.length > 0 &&
    selectedSupplierIds.length === activeSuppliers.length;

  const toggleAllSuppliers = () => {
    setSelectedSupplierIds(
      allSuppliersSelected ? [] : activeSuppliers.map((supplier) => supplier.id),
    );
  };

  const needsValue = mode !== "inherit";
  const canApply =
    selectedUserIds.length > 0 &&
    selectedSupplierIds.length > 0 &&
    (!needsValue || commissionValue.trim() !== "") &&
    !loading;

  const handleApply = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v2/commissions/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_ids: selectedUserIds,
          comercializadora_ids: selectedSupplierIds,
          mode,
          ...(needsValue
            ? {
                commission_type: commissionType,
                commission_value: Number(commissionValue) || 0,
              }
            : {}),
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        showCustomToast({
          title: "Error",
          message: data.error || "Error al aplicar las comisiones",
          icon: TriangleAlert,
          iconSize: 24,
          iconColor: "red",
        });
        return;
      }

      showCustomToast({
        title: "Comisiones aplicadas",
        message: `${data.data.updated_users} colaboradores actualizados en ${data.data.updated_companies} comercializadoras`,
        icon: Check,
        iconSize: 24,
        iconColor: "green",
      });
      onApplied?.();
      handleOpenChange(false);
    } catch {
      showCustomToast({
        title: "Error",
        message: "Error desconocido al aplicar las comisiones",
        icon: TriangleAlert,
        iconSize: 24,
        iconColor: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-gray-200">
          <Users size={16} className="mr-2" />
          Comisiones en bloque
        </Button>
      </DialogTrigger>
      <DialogContent
        aria-describedby={undefined}
        className="max-w-5xl border-gray-200 p-0 overflow-hidden"
      >
        <DialogHeader className="px-6 py-5 border-b border-gray-100 bg-gray-50/70">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 flex items-center justify-center">
              <Users className="text-blue-600" size={20} />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold text-gray-900">
                Comisiones en bloque
              </DialogTitle>
              <p className="text-sm text-gray-500">
                Aplica la misma comisión a varios comerciales a la vez
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-[68vh] overflow-y-auto p-6 space-y-6">
          <section className="rounded-3xl border border-gray-200 p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-gray-900">Colaboradores</h3>
                <p className="text-sm text-gray-500">
                  {selectedUserIds.length} seleccionados de {comerciales.length}{" "}
                  comerciales
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="border-gray-200"
                onClick={toggleAllVisible}
                disabled={loading || visibleUsers.length === 0}
              >
                {allVisibleSelected ? "Quitar selección" : "Seleccionar todos"}
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="bulk-team">Jefe de equipo</Label>
                <Select
                  value={teamFilter}
                  onValueChange={setTeamFilter}
                  disabled={loading}
                >
                  <SelectTrigger id="bulk-team">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_TEAMS}>Todos los equipos</SelectItem>
                    <SelectItem value={NO_TEAM}>Sin jefe de equipo</SelectItem>
                    {teams.map((lead) => (
                      <SelectItem key={lead.id} value={lead.id}>
                        Equipo de {lead.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bulk-search">Buscar</Label>
                <Input
                  id="bulk-search"
                  placeholder="Nombre o email"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            {visibleUsers.length === 0 ? (
              <div className="text-sm text-gray-500 py-6 text-center rounded-2xl bg-gray-50">
                No hay comerciales que coincidan con el filtro.
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto rounded-2xl border border-gray-100 divide-y divide-gray-100">
                {visibleUsers.map((comercial) => (
                  <label
                    key={comercial.id}
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50"
                  >
                    <Checkbox
                      checked={selectedUserIds.includes(comercial.id)}
                      onCheckedChange={() => toggleUser(comercial.id)}
                      disabled={loading}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {comercial.name}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {comercial.email}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-gray-200 p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-gray-900">
                  Comercializadoras
                </h3>
                <p className="text-sm text-gray-500">
                  {selectedSupplierIds.length} seleccionadas
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="border-gray-200"
                onClick={toggleAllSuppliers}
                disabled={loading || activeSuppliers.length === 0}
              >
                {allSuppliersSelected ? "Quitar todas" : "Todas"}
              </Button>
            </div>

            {suppliersLoading ? (
              <div className="text-sm text-gray-500 py-6 text-center">
                Cargando comercializadoras...
              </div>
            ) : activeSuppliers.length === 0 ? (
              <div className="text-sm text-gray-500 py-6 text-center">
                No hay comercializadoras activas.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {activeSuppliers.map((supplier) => {
                  const isSelected = selectedSupplierIds.includes(supplier.id);
                  return (
                    <button
                      key={supplier.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => toggleSupplier(supplier.id)}
                      disabled={loading}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm transition-colors",
                        isSelected
                          ? "border-blue-200 bg-blue-50 text-blue-700"
                          : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
                      )}
                    >
                      {supplier.name}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-gray-200 p-5 space-y-4">
            <div>
              <h3 className="font-semibold text-gray-900">Comisión a aplicar</h3>
              <p className="text-sm text-gray-500">
                Elige qué hacer con las comisiones personalizadas que ya existan.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {applyModes.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={mode === option.value}
                  onClick={() => setMode(option.value)}
                  disabled={loading}
                  className={cn(
                    "text-left rounded-2xl border p-3 transition-colors",
                    mode === option.value
                      ? "border-blue-200 bg-blue-50"
                      : "border-gray-200 bg-white hover:bg-gray-50",
                  )}
                >
                  <span className="block text-sm font-medium text-gray-900">
                    {option.label}
                  </span>
                  <span className="block text-xs text-gray-500 mt-1">
                    {option.hint}
                  </span>
                </button>
              ))}
            </div>

            {needsValue && (
              <div className="grid grid-cols-1 md:grid-cols-[140px_200px] gap-3">
                <div className="space-y-2">
                  <Label htmlFor="bulk-type">Tipo</Label>
                  <Select
                    value={commissionType}
                    onValueChange={(value: CommissionType) =>
                      setCommissionType(value)
                    }
                    disabled={loading}
                  >
                    <SelectTrigger id="bulk-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">%</SelectItem>
                      <SelectItem value="fixed">Fijo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bulk-value">Valor</Label>
                  <Input
                    id="bulk-value"
                    type="number"
                    min={0}
                    step={0.01}
                    placeholder="Ej. 15"
                    value={commissionValue}
                    onChange={(event) => setCommissionValue(event.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>
            )}
          </section>
        </div>

        <DialogFooter className="gap-3 px-6 py-4 border-t border-gray-100 bg-white sm:justify-between">
          <span className="text-sm text-gray-500 self-center">
            {selectedUserIds.length} colaboradores ×{" "}
            {selectedSupplierIds.length} comercializadoras
          </span>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              className="border-gray-200 text-gray-700 hover:bg-gray-50"
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleApply}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={!canApply}
            >
              {loading ? "Aplicando..." : "Aplicar comisiones"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
