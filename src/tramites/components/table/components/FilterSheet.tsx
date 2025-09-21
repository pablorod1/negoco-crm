"use client";

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/core/components/ui/sheet";
import { Button } from "@/core/components/ui/button";
import { FilterButton } from "./FilterButton";
import { FilterContent } from "./FilterContent";
import { DateRange } from "react-day-picker";
import type { User } from "@/core/types";

interface FilterSheetProps {
  activeFiltersCount: number;
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
  resetFilters: () => void;
  userData: User;
  isTramitesTable: boolean;
  isLiquidezTable: boolean;
}

export function FilterSheet({
  activeFiltersCount,
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
  resetFilters,
  userData,
  isTramitesTable,
  isLiquidezTable,
}: FilterSheetProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <FilterButton activeFiltersCount={activeFiltersCount} />
      </SheetTrigger>
      <SheetContent className="w-full max-w-2xl">
        <SheetHeader className="text-left">
          <SheetTitle className="text-xl font-bold text-gray-900">
            Filtros Avanzados
          </SheetTitle>
          <SheetDescription className="text-gray-600">
            Configura los filtros para refinar tu búsqueda
          </SheetDescription>
        </SheetHeader>

        <FilterContent
          statusFilter={statusFilter}
          liquidezStatusFilter={liquidezStatusFilter}
          contractTypeFilter={contractTypeFilter}
          companyFilter={companyFilter}
          activationDateRange={activationDateRange}
          creationDateRange={creationDateRange}
          renovationDateRange={renovationDateRange}
          collectionDateRange={collectionDateRange}
          paymentDateRange={paymentDateRange}
          userFilter={userFilter}
          providerFilter={providerFilter}
          setStatusFilter={setStatusFilter}
          setLiquidezStatusFilter={setLiquidezStatusFilter}
          setContractTypeFilter={setContractTypeFilter}
          setCompanyFilter={setCompanyFilter}
          setActivationDateRange={setActivationDateRange}
          setCreationDateRange={setCreationDateRange}
          setRenovationDateRange={setRenovationDateRange}
          setCollectionDateRange={setCollectionDateRange}
          setPaymentDateRange={setPaymentDateRange}
          setUserFilter={setUserFilter}
          setProviderFilter={setProviderFilter}
          userData={userData}
          isTramitesTable={isTramitesTable}
          isLiquidezTable={isLiquidezTable}
        />

        <SheetFooter className="flex-row gap-3 pt-4 border-t border-gray-100">
          <Button
            variant="outline"
            onClick={resetFilters}
            className="flex-1 border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            Limpiar Filtros
          </Button>
          <SheetClose asChild>
            <Button className="flex-1 bg-primary-600 hover:bg-primary-700 text-white">
              Aplicar Filtros
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
