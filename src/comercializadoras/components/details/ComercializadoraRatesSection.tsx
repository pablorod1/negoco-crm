"use client";

import { Database, Tag } from "lucide-react";

import type { ImaginaRate } from "@/comercializadoras/types";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/core/components/ui/card";
import { formatDate } from "@/core/utils/format";

interface ComercializadoraRatesSectionProps {
  rates: ImaginaRate[];
}

const getRateDisplayName = (rate: ImaginaRate): string =>
  rate.alias_externo?.trim() ||
  rate.name.trim() ||
  rate.external_rate_id?.trim() ||
  "Tarifa sin identificar";

const getSyncedAtLabel = (syncedAt: string | null): string | null => {
  if (!syncedAt || Number.isNaN(new Date(syncedAt).getTime())) return null;

  return formatDate(syncedAt);
};

export function ComercializadoraRatesSection({
  rates,
}: ComercializadoraRatesSectionProps) {
  const totalLabel = `${rates.length} ${
    rates.length === 1 ? "tarifa" : "tarifas"
  }`;

  return (
    <Card className="overflow-hidden bg-white shadow-xs">
      <section aria-labelledby="imagina-rates-heading">
        <CardHeader className="gap-4 border-b border-gray-100 bg-gray-50/70 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary-100 bg-primary-50 text-primary-600">
              <Tag className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h2
                id="imagina-rates-heading"
                className="text-lg font-semibold text-gray-950"
              >
                Tarifas sincronizadas
              </h2>
              <p className="text-sm text-gray-500">
                Catálogo de Imagina Energía disponible para contratación.
              </p>
            </div>
          </div>
          <span className="w-fit rounded-full border border-gray-200 bg-white px-3 py-1 text-sm font-medium text-gray-700 shadow-2xs">
            {totalLabel}
          </span>
        </CardHeader>

        <CardContent className="p-0">
          {rates.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-14 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-500">
                <Database className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="text-base font-semibold text-gray-900">
                Aún no hay tarifas sincronizadas
              </h3>
              <p className="mt-2 max-w-lg text-sm leading-6 text-gray-500">
                La integración está configurada, pero todavía no hay tarifas
                disponibles en el catálogo.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden">
              <div
                aria-hidden="true"
                className="hidden grid-cols-[minmax(0,1fr)_minmax(6rem,0.55fr)_minmax(0,1.2fr)_minmax(8rem,0.7fr)] gap-5 border-b border-gray-100 bg-white px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 md:grid"
              >
                <span>Tarifa</span>
                <span>Código ATR</span>
                <span>Descripción</span>
                <span>Sincronización</span>
              </div>

              <ul
                className="divide-y divide-gray-100"
                aria-label="Tarifas de Imagina Energía"
              >
                {rates.map((rate) => {
                  const displayName = getRateDisplayName(rate);
                  const syncedAtLabel = getSyncedAtLabel(rate.synced_at);

                  return (
                    <li
                      key={rate.id}
                      className="px-5 py-5 md:px-6"
                    >
                      <dl className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(6rem,0.55fr)_minmax(0,1.2fr)_minmax(8rem,0.7fr)] md:items-start md:gap-5">
                        <div className="min-w-0">
                          <dt className="text-xs font-medium text-gray-500 md:sr-only">
                            Tarifa
                          </dt>
                          <dd className="mt-1 md:mt-0">
                            <h3
                              title={displayName}
                              className="break-words text-sm font-semibold text-gray-950"
                            >
                              {displayName}
                            </h3>
                          </dd>
                        </div>

                        <div>
                          <dt className="text-xs font-medium text-gray-500 md:sr-only">
                            Código ATR
                          </dt>
                          <dd className="mt-1 text-sm font-medium text-gray-800 md:mt-0">
                            {rate.codigo_atr?.trim() || "Sin código ATR"}
                          </dd>
                        </div>

                        <div className="min-w-0">
                          <dt className="text-xs font-medium text-gray-500 md:sr-only">
                            Descripción
                          </dt>
                          <dd className="mt-1 text-sm leading-5 text-gray-600 md:mt-0">
                            {rate.descripcion?.trim() || "Sin descripción"}
                          </dd>
                        </div>

                        <div>
                          <dt className="text-xs font-medium text-gray-500 md:sr-only">
                            Sincronización
                          </dt>
                          <dd className="mt-1 text-sm text-gray-600 md:mt-0">
                            {syncedAtLabel && rate.synced_at ? (
                              <time dateTime={rate.synced_at}>
                                {syncedAtLabel}
                              </time>
                            ) : (
                              <span className="text-gray-500">
                                Sin fecha de sincronización
                              </span>
                            )}
                          </dd>
                        </div>
                      </dl>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </CardContent>
      </section>
    </Card>
  );
}
