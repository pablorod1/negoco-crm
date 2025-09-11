"use client";

import { Label } from "@/core/components/ui/label";
import MultipleSelector from "@/core/components/ui/multiselect";
import { DateRangePicker } from "@/dashboard/components/DateRangePicker";
import UserFilter from "@/core/components/table/UserFilter";
import { ProviderFilter } from "./ProviderFilter";
import {
  COMPANIES,
  CONTRACT_TYPES,
  LIQUIDEZ_STATUS,
  STATUS_TYPES,
} from "@/tramites/constants";
import { DateRange } from "react-day-picker";
import type { User } from "@/core/types";
import { useMultipleSelector } from "@/core/hooks/use-multiple-selector";

interface FilterContentProps {
  statusFilter: string[] | undefined;
  liquidezStatusFilter: string[] | undefined;
  contractTypeFilter: string[] | undefined;
  companyFilter: string[] | undefined;
  activationDateRange: DateRange | undefined;
  creationDateRange: DateRange | undefined;
  renovationDateRange: DateRange | undefined;
  collectionDateRange: DateRange | undefined;
  paymentDateRange: DateRange | undefined;
  userFilter: string[] | undefined;
  providerFilter: string[] | undefined;
  setStatusFilter: (value: string[]) => void;
  setLiquidezStatusFilter: (value: string[]) => void;
  setContractTypeFilter: (value: string[]) => void;
  setCompanyFilter: (value: string[]) => void;
  setActivationDateRange: (value: DateRange | undefined) => void;
  setCreationDateRange: (value: DateRange | undefined) => void;
  setRenovationDateRange: (value: DateRange | undefined) => void;
  setCollectionDateRange: (value: DateRange | undefined) => void;
  setPaymentDateRange: (value: DateRange | undefined) => void;
  setUserFilter: (value: string[] | undefined) => void;
  setProviderFilter: (value: string[]) => void;
  userData: User;
  isTramitesTable: boolean;
  isLiquidezTable: boolean;
}

export function FilterContent({
  statusFilter,
  liquidezStatusFilter,
  contractTypeFilter,
  companyFilter,
  activationDateRange,
  creationDateRange,
  renovationDateRange,
  collectionDateRange,
  paymentDateRange,
  userFilter,
  providerFilter,
  setStatusFilter,
  setLiquidezStatusFilter,
  setContractTypeFilter,
  setCompanyFilter,
  setActivationDateRange,
  setCreationDateRange,
  setRenovationDateRange,
  setCollectionDateRange,
  setPaymentDateRange,
  setUserFilter,
  setProviderFilter,
  userData,
  isTramitesTable,
  isLiquidezTable,
}: FilterContentProps) {
  const isComercial = userData?.role === "2";

  const { convertToOptions, convertFromOptions, getSelectedOptions } =
    useMultipleSelector();

  return (
    <div className="py-6 space-y-8">
      {/* Filtros Principales */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
          Filtros Principales
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <Label className="text-sm font-medium text-gray-700">Estado</Label>
            <MultipleSelector
              value={getSelectedOptions(
                statusFilter,
                isTramitesTable
                  ? STATUS_TYPES
                  : isLiquidezTable
                    ? [
                        { label: "Activo", value: "Activo" },
                        { label: "Baja", value: "Baja" },
                      ]
                    : []
              )}
              defaultOptions={convertToOptions(
                isTramitesTable
                  ? STATUS_TYPES
                  : isLiquidezTable
                    ? [
                        { label: "Activo", value: "Activo" },
                        { label: "Baja", value: "Baja" },
                      ]
                    : []
              )}
              onChange={(options) =>
                setStatusFilter(convertFromOptions(options))
              }
              placeholder="Seleccionar estado"
              hidePlaceholderWhenSelected
              emptyIndicator={
                <p className="text-center text-sm text-gray-500">
                  No se encontraron resultados
                </p>
              }
            />
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium text-gray-700">
              Estado de liquidez
            </Label>
            <MultipleSelector
              value={getSelectedOptions(liquidezStatusFilter, LIQUIDEZ_STATUS)}
              defaultOptions={convertToOptions(LIQUIDEZ_STATUS)}
              onChange={(options) =>
                setLiquidezStatusFilter(convertFromOptions(options))
              }
              placeholder="Seleccionar estado de liquidez"
              hidePlaceholderWhenSelected
              emptyIndicator={
                <p className="text-center text-sm text-gray-500">
                  No se encontraron resultados
                </p>
              }
            />
          </div>

          {isTramitesTable && (
            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-700">
                Tipo de Contrato
              </Label>
              <MultipleSelector
                value={getSelectedOptions(contractTypeFilter, CONTRACT_TYPES)}
                defaultOptions={convertToOptions(CONTRACT_TYPES)}
                onChange={(options) =>
                  setContractTypeFilter(convertFromOptions(options))
                }
                placeholder="Seleccionar tipo de contrato"
                hidePlaceholderWhenSelected
                emptyIndicator={
                  <p className="text-center text-sm text-gray-500">
                    No se encontraron resultados
                  </p>
                }
              />
            </div>
          )}

          <div className="space-y-3">
            <Label className="text-sm font-medium text-gray-700">
              Compañía
            </Label>
            <MultipleSelector
              value={getSelectedOptions(companyFilter, COMPANIES)}
              defaultOptions={convertToOptions(COMPANIES)}
              onChange={(options) =>
                setCompanyFilter(convertFromOptions(options))
              }
              placeholder="Seleccionar compañías"
              hidePlaceholderWhenSelected
              emptyIndicator={
                <p className="text-center text-sm text-gray-500">
                  No se encontraron resultados
                </p>
              }
            />
          </div>
        </div>
      </div>

      {/* Filtros de Fechas */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
          Filtros por Fecha
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {isTramitesTable && (
            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-700">
                Fecha de Creación
              </Label>
              <DateRangePicker
                date={creationDateRange}
                setDateRange={setCreationDateRange}
              />
            </div>
          )}

          <div className="space-y-3">
            <Label className="text-sm font-medium text-gray-700">
              Fecha de Activación
            </Label>
            <DateRangePicker
              date={activationDateRange}
              setDateRange={setActivationDateRange}
            />
          </div>

          {isTramitesTable && !isComercial && (
            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-700">
                Fecha de Renovación
              </Label>
              <DateRangePicker
                date={renovationDateRange}
                setDateRange={setRenovationDateRange}
              />
            </div>
          )}

          {isLiquidezTable && !isComercial && (
            <>
              <div className="space-y-3">
                <Label className="text-sm font-medium text-gray-700">
                  Fecha de Cobro
                </Label>
                <DateRangePicker
                  date={collectionDateRange}
                  setDateRange={setCollectionDateRange}
                />
              </div>
              <div className="space-y-3">
                <Label className="text-sm font-medium text-gray-700">
                  Fecha de Pago
                </Label>
                <DateRangePicker
                  date={paymentDateRange}
                  setDateRange={setPaymentDateRange}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Filtros Específicos */}
      {(isLiquidezTable || !isComercial) && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
            Filtros Específicos
          </h3>
          <div className="grid grid-cols-1 gap-4">
            {isLiquidezTable && (
              <ProviderFilter
                providerFilter={providerFilter}
                setProviderFilter={setProviderFilter}
              />
            )}

            {!isComercial && (
              <div className="space-y-3">
                <UserFilter
                  isComercial={isComercial}
                  userData={userData}
                  userFilter={userFilter}
                  setUserFilter={setUserFilter}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
