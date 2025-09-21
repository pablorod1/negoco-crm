"use client";

import { X } from "lucide-react";
import { Badge } from "@/core/components/ui/badge";
import { Button } from "@/core/components/ui/button";
import { DateRange } from "react-day-picker";
import { getFilterLabel } from "@/tramites/utils/formatters";
import {
  STATUS_TYPES,
  LIQUIDEZ_STATUS,
  CONTRACT_TYPES,
  COMPANIES,
} from "@/tramites/constants";

interface ActiveFiltersProps {
  statusFilter: string[] | undefined;
  liquidezStatusFilter: string[] | undefined;
  contractTypeFilter: string[] | undefined;
  companyFilter: string[] | undefined;
  creationDateRange: DateRange | undefined;
  activationDateRange: DateRange | undefined;
  renovationDateRange: DateRange | undefined;
  collectionDateRange: DateRange | undefined;
  paymentDateRange: DateRange | undefined;
  userFilter: string[] | undefined;
  providerFilter: string[] | undefined;
  isComercial: boolean;
  onResetFilters: () => void;
  onRemoveProvider: (provider: string) => void;
}

export function ActiveFilters({
  statusFilter,
  liquidezStatusFilter,
  contractTypeFilter,
  companyFilter,
  creationDateRange,
  activationDateRange,
  renovationDateRange,
  collectionDateRange,
  paymentDateRange,
  userFilter,
  providerFilter,
  isComercial,
  onResetFilters,
  onRemoveProvider,
}: ActiveFiltersProps) {
  const hasActiveFilters =
    (statusFilter && statusFilter.length > 0) ||
    (liquidezStatusFilter && liquidezStatusFilter.length > 0) ||
    (contractTypeFilter && contractTypeFilter.length > 0) ||
    (companyFilter && companyFilter.length > 0) ||
    (creationDateRange && (creationDateRange.from || creationDateRange.to)) ||
    (activationDateRange &&
      (activationDateRange.from || activationDateRange.to)) ||
    (renovationDateRange &&
      (renovationDateRange.from || renovationDateRange.to)) ||
    (collectionDateRange &&
      (collectionDateRange.from || collectionDateRange.to)) ||
    (paymentDateRange && (paymentDateRange.from || paymentDateRange.to)) ||
    (userFilter && userFilter.length > 0 && !isComercial) ||
    (providerFilter && providerFilter.length > 0);

  if (!hasActiveFilters) return null;

  return (
    <div className="mt-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-gray-500 font-medium">
          Filtros activos:
        </span>
        <div className="flex gap-2 flex-wrap">
          {statusFilter && statusFilter.length > 0 && (
            <Badge
              variant="secondary"
              className="bg-gray-100 text-gray-700 border-gray-200 gap-1.5 flex items-center px-3 py-1"
            >
              <span className="text-xs font-medium">Estado:</span>
              <span className="text-xs">
                {getFilterLabel("select", statusFilter, STATUS_TYPES)}
              </span>
            </Badge>
          )}

          {liquidezStatusFilter && liquidezStatusFilter.length > 0 && (
            <Badge
              variant="secondary"
              className="bg-gray-100 text-gray-700 border-gray-200 gap-1.5 flex items-center px-3 py-1"
            >
              <span className="text-xs font-medium">Liquidez:</span>
              <span className="text-xs">
                {getFilterLabel(
                  "select",
                  liquidezStatusFilter,
                  LIQUIDEZ_STATUS
                )}
              </span>
            </Badge>
          )}

          {contractTypeFilter && contractTypeFilter.length > 0 && (
            <Badge
              variant="secondary"
              className="bg-gray-100 text-gray-700 border-gray-200 gap-1.5 flex items-center px-3 py-1"
            >
              <span className="text-xs font-medium">Contrato:</span>
              <span className="text-xs">
                {getFilterLabel("select", contractTypeFilter, CONTRACT_TYPES)}
              </span>
            </Badge>
          )}

          {companyFilter && companyFilter.length > 0 && (
            <Badge
              variant="secondary"
              className="bg-gray-100 text-gray-700 border-gray-200 gap-1.5 flex items-center px-3 py-1"
            >
              <span className="text-xs font-medium">Compañía:</span>
              <span className="text-xs">
                {getFilterLabel("select", companyFilter, COMPANIES)}
              </span>
            </Badge>
          )}

          {creationDateRange &&
            (creationDateRange.from || creationDateRange.to) && (
              <Badge
                variant="secondary"
                className="bg-gray-100 text-gray-700 border-gray-200 gap-1.5 flex items-center px-3 py-1"
              >
                <span className="text-xs font-medium">Creación:</span>
                <span className="text-xs">
                  {getFilterLabel("date", creationDateRange)}
                </span>
              </Badge>
            )}

          {activationDateRange &&
            (activationDateRange.from || activationDateRange.to) && (
              <Badge
                variant="secondary"
                className="bg-gray-100 text-gray-700 border-gray-200 gap-1.5 flex items-center px-3 py-1"
              >
                <span className="text-xs font-medium">Activación:</span>
                <span className="text-xs">
                  {getFilterLabel("date", activationDateRange)}
                </span>
              </Badge>
            )}

          {renovationDateRange &&
            (renovationDateRange.from || renovationDateRange.to) && (
              <Badge
                variant="secondary"
                className="bg-gray-100 text-gray-700 border-gray-200 gap-1.5 flex items-center px-3 py-1"
              >
                <span className="text-xs font-medium">Renovación:</span>
                <span className="text-xs">
                  {getFilterLabel("date", renovationDateRange)}
                </span>
              </Badge>
            )}

          {collectionDateRange &&
            (collectionDateRange.from || collectionDateRange.to) && (
              <Badge
                variant="secondary"
                className="bg-gray-100 text-gray-700 border-gray-200 gap-1.5 flex items-center px-3 py-1"
              >
                <span className="text-xs font-medium">Cobro:</span>
                <span className="text-xs">
                  {getFilterLabel("date", collectionDateRange)}
                </span>
              </Badge>
            )}

          {paymentDateRange &&
            (paymentDateRange.from || paymentDateRange.to) && (
              <Badge
                variant="secondary"
                className="bg-gray-100 text-gray-700 border-gray-200 gap-1.5 flex items-center px-3 py-1"
              >
                <span className="text-xs font-medium">Pago:</span>
                <span className="text-xs">
                  {getFilterLabel("date", paymentDateRange)}
                </span>
              </Badge>
            )}

          {userFilter && userFilter.length > 0 && !isComercial && (
            <Badge
              variant="secondary"
              className="bg-gray-100 text-gray-700 border-gray-200 gap-1.5 flex items-center px-3 py-1"
            >
              <span className="text-xs font-medium">Comerciales:</span>
              <span className="text-xs">
                {userFilter.length} seleccionado(s)
              </span>
            </Badge>
          )}

          {providerFilter && providerFilter.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {providerFilter.map((provider) => (
                <Badge
                  key={provider}
                  variant="secondary"
                  className="bg-gray-100 text-gray-700 border-gray-200 gap-1.5 flex items-center px-3 py-1"
                >
                  <span className="text-xs font-medium">Proveedor:</span>
                  <span className="text-xs">{provider}</span>
                  <button
                    onClick={() => onRemoveProvider(provider)}
                    className="ml-1 hover:text-red-600 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onResetFilters}
          className="h-8 px-3 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Limpiar todo
        </Button>
      </div>
    </div>
  );
}
