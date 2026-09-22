"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Users } from "lucide-react";
import { Checkbox } from "@/core/components/ui/checkbox";
import { Button } from "@/core/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/core/components/ui/tabs";
import type { CommissionSegment, User, UserCompanyCommission } from "@/core/types";
import type { AbarcaUserSyncStatus } from "@/core/hooks/use-abarca-sync-statuses";
import { useActiveEnergySuppliers } from "@/comercializadoras/hooks/useActiveEnergySuppliers";
import { useDefaultCompanyCommissions } from "@/core/hooks/use-default-company-commissions";
import { COMMISSION_SEGMENTS, COMMISSION_SEGMENT_LABELS } from "@/core/utils/commission-segment";
import CommissionDefaultsEditor from "./commissions/CommissionDefaultsEditor";
import OverrideMatrixEditor from "./commissions/OverrideMatrixEditor";
import SyncIssuesPanel from "./commissions/SyncIssuesPanel";

interface Props {
  users: User[];
  statuses: AbarcaUserSyncStatus[];
  onStatusesChanged: () => Promise<void> | void;
  onStatusesCheck: () => Promise<void> | void;
}

export default function CommissionsPanel({ users, statuses, onStatusesChanged, onStatusesCheck }: Props) {
  const [segments, setSegments] = useState<CommissionSegment[]>(["luz_20td"]);
  const [overrides, setOverrides] = useState<UserCompanyCommission[]>([]);
  const [overridesLoading, setOverridesLoading] = useState(true);
  const [overridesError, setOverridesError] = useState(false);
  const [defaultsDirty, setDefaultsDirty] = useState(false);
  const { activeSuppliers, loading: suppliersLoading } = useActiveEnergySuppliers();
  const { defaults, loading: defaultsLoading, refetch: refetchDefaults } = useDefaultCompanyCommissions(true);

  const fetchOverrides = useCallback(async () => {
    setOverridesLoading(true);
    setOverridesError(false);
    try {
      const response = await fetch("/api/v2/commissions/overrides");
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error("No se pudieron cargar las comisiones");
      setOverrides(Array.isArray(result.data) ? result.data : []);
    } catch {
      setOverridesError(true);
    } finally {
      setOverridesLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void fetchOverrides());
  }, [fetchOverrides]);

  return (
    <div className="space-y-4">
      <SyncIssuesPanel statuses={statuses} onChanged={onStatusesChanged} onCheck={onStatusesCheck} />
      <Tabs defaultValue="defaults" className="rounded-3xl border border-gray-200 bg-white">
        <div className="space-y-4 border-b border-gray-200 p-4 sm:p-5">
          <TabsList aria-label="Configuración de comisiones" className="grid h-auto w-full grid-cols-2 rounded-xl bg-gray-100 p-1 sm:w-fit">
            <TabsTrigger value="defaults" className="gap-2 whitespace-normal rounded-lg py-2.5">
              <Building2 size={16} className="shrink-0" /> Por defecto{defaultsDirty && <span aria-label="Cambios sin guardar" className="size-2 rounded-full bg-amber-500" />}
            </TabsTrigger>
            <TabsTrigger value="collaborators" className="gap-2 whitespace-normal rounded-lg py-2.5">
              <Users size={16} className="shrink-0" /> Por colaborador
            </TabsTrigger>
          </TabsList>
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-gray-900">¿A qué segmentos quieres aplicar los cambios?</legend>
            <div className="flex flex-wrap gap-2">
              {COMMISSION_SEGMENTS.map((segment) => (
                <label key={segment} className="flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm has-[[data-state=checked]]:border-blue-300 has-[[data-state=checked]]:bg-blue-50 has-[[data-state=checked]]:text-blue-800">
                  <Checkbox
                    checked={segments.includes(segment)}
                    disabled={segments.length === 1 && segments.includes(segment)}
                    onCheckedChange={(checked) => setSegments((current) => checked ? COMMISSION_SEGMENTS.filter((value) => current.includes(value) || value === segment) : current.filter((value) => value !== segment))}
                  />
                  {COMMISSION_SEGMENT_LABELS[segment]}
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500">Puedes seleccionar varios. Cada valor que edites se aplicará a todos los segmentos marcados.</p>
          </fieldset>
        </div>
        <TabsContent value="defaults" forceMount className="mt-0 data-[state=inactive]:hidden">
          <CommissionDefaultsEditor
            suppliers={activeSuppliers} defaults={defaults} segments={segments}
            loading={suppliersLoading || defaultsLoading} onDirtyChange={setDefaultsDirty}
            onSaved={async () => { await refetchDefaults(); await onStatusesChanged(); }}
          />
        </TabsContent>
        <TabsContent value="collaborators" forceMount className="mt-0 data-[state=inactive]:hidden">
          {overridesError ? (
            <div role="alert" className="space-y-3 p-6 text-sm text-red-700">
              <p>No se han podido cargar las comisiones personalizadas.</p>
              <Button variant="outline" onClick={fetchOverrides}>Reintentar</Button>
            </div>
          ) : (
            <OverrideMatrixEditor
              users={users} suppliers={activeSuppliers} defaults={defaults} overrides={overrides} segments={segments}
              loading={suppliersLoading || defaultsLoading || overridesLoading}
              onRefetch={async () => { await fetchOverrides(); await onStatusesChanged(); }}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
