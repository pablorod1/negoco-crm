import { DateRange } from "react-day-picker";

/**
 * Filters shared by the tramites/liquidez table and its Excel export.
 * Both must serialise them identically or the exported file stops matching
 * what the user is looking at.
 */
export interface ContractsQueryFilters {
  filterValue: string;
  companyFilter: string[] | undefined;
  statusFilter: string[] | undefined;
  liquidezStatusFilter: string[] | undefined;
  contractTypeFilter: string[] | undefined;
  activationDateRange: DateRange | undefined;
  creationDateRange: DateRange | undefined;
  renovationDateRange: DateRange | undefined;
  collectionDateRange: DateRange | undefined;
  paymentDateRange: DateRange | undefined;
  userFilter: string[] | undefined;
  providerFilter: string[] | undefined;
  excludeCompany: boolean;
  excludeUser: boolean;
  isTramitesTable: boolean;
  isLiquidezTable: boolean;
}

/**
 * Serialises the active table filters into query params.
 * Pagination and user identity are added by the caller: the export endpoint
 * takes neither (it reads the user from the session and returns every match).
 */
export function buildContractsQueryParams(
  filters: ContractsQueryFilters,
): URLSearchParams {
  const {
    filterValue,
    companyFilter,
    statusFilter,
    liquidezStatusFilter,
    contractTypeFilter,
    activationDateRange,
    creationDateRange,
    renovationDateRange,
    collectionDateRange,
    paymentDateRange,
    userFilter,
    providerFilter,
    excludeCompany,
    excludeUser,
    isTramitesTable,
    isLiquidezTable,
  } = filters;

  const params = new URLSearchParams();

  if (filterValue) params.append("filterValue", filterValue);
  if (companyFilter && companyFilter.length > 0) {
    params.append("companyFilter", JSON.stringify(companyFilter));
    if (excludeCompany) params.append("excludeCompany", "true");
  }

  // Liquidez only ever deals with activated/cancelled tramites unless the user
  // narrowed the status explicitly.
  const statusToSend = isTramitesTable
    ? statusFilter
    : isLiquidezTable && statusFilter
      ? statusFilter
      : ["Activo", "Baja"];
  if (statusToSend && statusToSend.length > 0) {
    params.append("statusFilter", JSON.stringify(statusToSend));
  }

  if (liquidezStatusFilter && liquidezStatusFilter.length > 0) {
    params.append("liquidezStatusFilter", JSON.stringify(liquidezStatusFilter));
  }
  if (contractTypeFilter && contractTypeFilter.length > 0) {
    params.append("contractTypeFilter", JSON.stringify(contractTypeFilter));
  }
  if (activationDateRange) {
    params.append("activationDateRange", JSON.stringify(activationDateRange));
  }
  if (creationDateRange) {
    params.append("creationDateRange", JSON.stringify(creationDateRange));
  }
  if (renovationDateRange) {
    params.append("renovationDateRange", JSON.stringify(renovationDateRange));
  }
  if (isLiquidezTable && collectionDateRange) {
    params.append("collectionDateRange", JSON.stringify(collectionDateRange));
  }
  if (isLiquidezTable && paymentDateRange) {
    params.append("paymentDateRange", JSON.stringify(paymentDateRange));
  }
  if (userFilter && userFilter.length > 0) {
    params.append("userFilter", JSON.stringify(userFilter));
    if (excludeUser) params.append("excludeUser", "true");
  }
  if (isLiquidezTable && providerFilter && providerFilter.length > 0) {
    params.append("providerFilter", JSON.stringify(providerFilter));
  }

  return params;
}
