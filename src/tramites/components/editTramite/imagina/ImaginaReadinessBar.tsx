"use client";
import { useMemo } from "react";
import { CircleCheck, Info } from "lucide-react";
import { Progress } from "@/core/components/ui/progress";
import TooltipComponent from "@/core/components/TooltipComponent";
import { cn } from "@/core/utils";
import type { ContractDB, TramiteVM } from "@/tramites/types";
import { useActiveEnergySuppliers } from "@/comercializadoras/hooks/useActiveEnergySuppliers";
import { useImaginaReadiness } from "@/tramites/hooks/useImaginaReadiness";
import { findImaginaContract } from "@/tramites/utils/imagina-contract";
import {
  computeImaginaProgress,
  groupImaginaMissingFields,
} from "@/tramites/utils/imagina-missing-fields";

interface Props {
  tramite: TramiteVM;
  contracts: ContractDB[];
}

// Solo tiene sentido mientras el contrato aún no se ha enviado.
const PRE_SEND_STATUSES = new Set(["Borrador", "Tramitable", "Verificado"]);

export default function ImaginaReadinessBar({ tramite, contracts }: Props) {
  const { activeSuppliers } = useActiveEnergySuppliers();
  const imaginaContract = useMemo(
    () => findImaginaContract(contracts, activeSuppliers),
    [activeSuppliers, contracts],
  );
  const applies =
    PRE_SEND_STATUSES.has(tramite.status) && Boolean(imaginaContract);

  const { readiness } = useImaginaReadiness({
    tramiteId: tramite.id,
    contractId: imaginaContract?.id,
    enabled: applies,
    // Los props se renuevan con cada refetch del trámite.
    refreshKey: contracts,
  });

  if (!applies || !readiness?.configured) return null;

  const progress = computeImaginaProgress(readiness.required, readiness.missing);
  const groups = groupImaginaMissingFields(readiness.missing);
  const complete = groups.length === 0;

  const tooltip = complete ? (
    <p className="text-sm">Todos los datos necesarios están completos.</p>
  ) : (
    <div className="max-w-xs space-y-2 p-1">
      <p className="text-sm font-semibold">Faltan datos para Imagina Energía</p>
      {groups.map((group) => (
        <div key={group.source}>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            {group.label}
          </p>
          <ul className="ml-3 list-disc text-xs">
            {group.items.map((item, index) => (
              <li key={`${item.field}-${index}`}>{item.label}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );

  return (
    <TooltipComponent
      content={tooltip}
      placement="bottom"
      color="bg-white text-gray-800 shadow-lg border border-gray-200"
    >
      <div
        className="cursor-help space-y-1.5"
        aria-label="Datos para Imagina Energía"
      >
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="flex items-center gap-1 text-gray-500">
            Datos para Imagina Energía
            {complete ? (
              <CircleCheck className="size-3.5 text-success-500" />
            ) : (
              <Info className="size-3.5 text-gray-400" />
            )}
          </span>
          <span
            className={cn(
              "tabular-nums font-medium",
              complete ? "text-success-600" : "text-gray-700",
            )}
          >
            {progress.completed}/{progress.total}
          </span>
        </div>
        <Progress
          value={progress.percent}
          className="h-1 bg-gray-100"
          indicatorClassName={
            complete ? "bg-success-500" : "bg-warning-500"
          }
        />
      </div>
    </TooltipComponent>
  );
}
