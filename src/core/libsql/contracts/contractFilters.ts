import { Client } from "@libsql/client";
import { executeReadWithRetry } from "@/core/libsql/executeWithRetry";
import { getSubcomerciales } from "@/core/libsql/users/getSubcomerciales";

/**
 * Shared query building for the contracts (tramites) listing.
 *
 * Both GET /api/v2/contracts (paginated table) and GET /api/v2/contracts/export
 * (full Excel export) must resolve the exact same set of tramites for a given
 * set of filters — otherwise the exported file silently disagrees with what the
 * user sees on screen. Keeping the WHERE construction here is what guarantees it.
 */

export interface DateRangeInput {
  from?: Date;
  to?: Date;
}

export interface ContractFilterInput {
  user_id: string;
  user_role: string;
  filterValue?: string;
  companyFilter?: string[];
  statusFilter?: string[];
  liquidezStatusFilter?: string[];
  contractTypeFilter?: string[];
  activationDateRange?: DateRangeInput;
  creationDateRange?: DateRangeInput;
  renovationDateRange?: DateRangeInput;
  collectionDateRange?: DateRangeInput;
  paymentDateRange?: DateRangeInput;
  userFilter?: string[];
  clientFilter?: string;
  providerFilter?: string[];
  excludeCompany?: boolean;
  excludeUser?: boolean;
}

export interface ContractFilterResult {
  filters: string[];
  params: (string | number)[];
  needsContractsJoin: boolean;
  needsClientsJoin: boolean;
}

/** Parses a JSON-encoded date range query param, tolerating malformed input. */
export const parseDateRangeParam = (
  param: string | null,
): DateRangeInput | undefined => {
  if (!param) return undefined;
  try {
    const parsed = JSON.parse(decodeURIComponent(param));
    if (!parsed || typeof parsed !== "object") return undefined;
    const obj = parsed as { from?: string; to?: string };
    const fromVal = obj.from;
    const toVal = obj.to;
    const result: DateRangeInput = {};
    if (fromVal) result.from = new Date(fromVal);
    if (toVal) result.to = new Date(toVal);
    return result;
  } catch {
    return undefined;
  }
};

/** Parses a JSON-encoded array query param, falling back to comma splitting. */
export const parseArrayParam = (
  param: string | null,
): string[] | undefined => {
  if (!param) return undefined;
  try {
    const decoded = decodeURIComponent(param);
    return JSON.parse(decoded);
  } catch {
    // Fallback: split by comma if not valid JSON
    return param.split(",").filter(Boolean);
  }
};

/**
 * Reads every filter the tramites/liquidez table can apply off a URL.
 * Pagination params are deliberately excluded: the export route has none.
 */
export function parseContractFilterParams(
  searchParams: URLSearchParams,
): Omit<ContractFilterInput, "user_id" | "user_role"> {
  return {
    filterValue: searchParams.get("filterValue") || undefined,
    companyFilter: parseArrayParam(searchParams.get("companyFilter")),
    statusFilter: parseArrayParam(searchParams.get("statusFilter")),
    liquidezStatusFilter: parseArrayParam(
      searchParams.get("liquidezStatusFilter"),
    ),
    contractTypeFilter: parseArrayParam(searchParams.get("contractTypeFilter")),
    activationDateRange: parseDateRangeParam(
      searchParams.get("activationDateRange"),
    ),
    creationDateRange: parseDateRangeParam(
      searchParams.get("creationDateRange"),
    ),
    renovationDateRange: parseDateRangeParam(
      searchParams.get("renovationDateRange"),
    ),
    collectionDateRange: parseDateRangeParam(
      searchParams.get("collectionDateRange"),
    ),
    paymentDateRange: parseDateRangeParam(searchParams.get("paymentDateRange")),
    userFilter: parseArrayParam(searchParams.get("userFilter")),
    clientFilter: searchParams.get("clientFilter") || undefined,
    providerFilter: parseArrayParam(searchParams.get("providerFilter")),
    excludeCompany: searchParams.get("excludeCompany") === "true",
    excludeUser: searchParams.get("excludeUser") === "true",
  };
}

/**
 * Builds the WHERE fragments (and their bound params) for a tramites query,
 * including role-based visibility rules.
 */
export async function buildContractFilters(
  tursoClient: Client,
  input: ContractFilterInput,
): Promise<ContractFilterResult> {
  const {
    user_id,
    user_role,
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
    clientFilter,
    providerFilter,
    excludeCompany,
    excludeUser,
  } = input;

  const filters: string[] = [];
  const params: (string | number)[] = [];

  // User role-based filtering
  if (user_role === "2") {
    const subcomerciales = await getSubcomerciales(tursoClient, user_id);
    if (subcomerciales.success && subcomerciales.ids.length > 0) {
      filters.push(
        `(t.user_id = ? OR t.user_id IN (${subcomerciales.ids
          .map(() => "?")
          .join(", ")}))`,
      );
      params.push(user_id, ...subcomerciales.ids);
    } else {
      filters.push(`t.user_id = ?`);
      params.push(user_id);
    }
  } else {
    // For other roles: apply userFilter if provided, otherwise show all non-draft tramites
    if (userFilter && userFilter.length > 0) {
      const operator = excludeUser ? "NOT IN" : "IN";
      filters.push(
        `(t.user_id ${operator} (${userFilter.map(() => "?").join(", ")}) AND
           (t.user_id = ? OR t.status != 'Borrador'))`,
      );
      params.push(...userFilter, user_id);
    } else {
      filters.push(
        `(t.user_id = ? OR (t.user_id != ? AND t.status != 'Borrador'))`,
      );
      params.push(user_id, user_id);
    }
  }

  // Dynamic text filter helper
  const addTextFilter = (fields: string[], value: string) => {
    const likeConditions = fields.map((field) => `${field} LIKE ?`).join(" OR ");
    filters.push(`(${likeConditions})`);
    fields.forEach(() => params.push(`%${value}%`));
  };

  // Apply text search filter
  if (filterValue) {
    addTextFilter(
      ["t.id", "t.sales_name", "c.name", "c.last_name", "c.email", "con.CUPS"],
      filterValue,
    );
  }

  // Array-based filters helper
  const addArrayFilter = (column: string, filterArray?: string[]) => {
    if (filterArray && filterArray.length > 0) {
      filters.push(`${column} IN (${filterArray.map(() => "?").join(", ")})`);
      params.push(...filterArray);
    }
  };

  // Company filter: single batch query instead of N+1
  const addCompanyFilter = async (
    filterArray?: string[],
    exclude?: boolean,
  ) => {
    if (!filterArray || filterArray.length === 0) return;

    const placeholders = filterArray.map(() => "?").join(", ");
    const companyResult = await executeReadWithRetry(tursoClient, {
      sql: `SELECT name FROM comercializadoras WHERE id IN (${placeholders})`,
      args: filterArray,
    });
    const companyNames = companyResult.rows.map((r) => r.name as string);

    // Match by both ID and resolved name
    const allValues = [...filterArray, ...companyNames];
    const allPlaceholders = allValues.map(() => "?").join(", ");
    if (exclude) {
      filters.push(
        `t.id NOT IN (SELECT tramite_id FROM contracts WHERE tramite_id IS NOT NULL AND new_company IN (${allPlaceholders}))`,
      );
    } else {
      filters.push(`con.new_company IN (${allPlaceholders})`);
    }
    params.push(...allValues);
  };

  // Provider filter helper (case-insensitive)
  const addProviderFilter = (filterArray?: string[]) => {
    if (filterArray && filterArray.length > 0) {
      const providerConditions = filterArray
        .map(() => "LOWER(t.provider) LIKE LOWER(?)")
        .join(" OR ");
      filters.push(`(${providerConditions})`);
      // Add wildcards for partial matching
      params.push(...filterArray.map((provider) => `%${provider}%`));
    }
  };

  if (companyFilter) {
    await addCompanyFilter(companyFilter, excludeCompany);
  }
  addArrayFilter("t.status", statusFilter);
  addArrayFilter("con.type", contractTypeFilter);
  addArrayFilter("t.liquidez_status", liquidezStatusFilter);
  if (clientFilter) {
    addArrayFilter("c.id", [clientFilter]);
  }

  if (providerFilter) {
    addProviderFilter(providerFilter);
  }

  // Date range filter helper
  const addDateRangeFilter = (column: string, dateRange?: DateRangeInput) => {
    if (dateRange && dateRange.from && dateRange.to) {
      const fromDate = new Date(dateRange.from);
      const toExclusiveDate = new Date(dateRange.to);

      toExclusiveDate.setDate(toExclusiveDate.getDate() + 1);

      filters.push(`(${column} >= ? AND ${column} < ?)`);
      params.push(fromDate.toISOString(), toExclusiveDate.toISOString());
    }
  };

  // Apply date range filters
  addDateRangeFilter("t.activation_date", activationDateRange);
  addDateRangeFilter("t.creation_date", creationDateRange);
  addDateRangeFilter("t.renovation_date", renovationDateRange);
  addDateRangeFilter("t.collection_date", collectionDateRange);
  addDateRangeFilter("t.payment_date", paymentDateRange);

  // Determine which JOINs are required by the active filters. This lets
  // the count + pagination phase avoid the expensive contracts/comercializadoras
  // joins when not needed, which is the main source of memory blow-up.
  const needsContractsJoin =
    Boolean(filterValue) ||
    (contractTypeFilter?.length ?? 0) > 0 ||
    ((companyFilter?.length ?? 0) > 0 && !excludeCompany);
  const needsClientsJoin = Boolean(filterValue) || Boolean(clientFilter);

  return { filters, params, needsContractsJoin, needsClientsJoin };
}

/**
 * Builds the FROM/JOIN/WHERE fragment shared by the count and id-selection
 * queries. Joins are conditional to keep the scan as narrow as the filters allow.
 */
export function buildContractBaseQuery({
  filters,
  needsClientsJoin,
  needsContractsJoin,
}: Pick<
  ContractFilterResult,
  "filters" | "needsClientsJoin" | "needsContractsJoin"
>): string {
  let baseQuery = `
      FROM
          tramites t
    `;

  if (needsClientsJoin) {
    baseQuery += `
      LEFT JOIN
          clients c ON t.client_id = c.id
      `;
  }

  if (needsContractsJoin) {
    baseQuery += `
      LEFT JOIN
          contracts con ON t.id = con.tramite_id
      `;
  }

  if (filters.length > 0) {
    baseQuery += ` WHERE ` + filters.join(" AND ");
  }

  return baseQuery;
}

/**
 * Hydration query for a bounded set of tramite ids. GROUP_CONCAT only ever runs
 * over the ids passed in, which is what keeps SQLITE_NOMEM off the table.
 */
export function buildContractHydrationQuery(idCount: number): string {
  const idPlaceholders = Array.from({ length: idCount }, () => "?").join(", ");

  return `
        SELECT
            t.id AS id,
            t.creation_date AS creation_date,
            t.activation_date AS activation_date,
            t.renovation_date AS renovation_date,
            t.collection_date AS collection_date,
            t.payment_date AS payment_date,
            t.rejected_date AS rejected_date,
            t.sales_name AS sales_name,
            t.comision_sales_person AS comision_sales_person,
            t.comision AS comision,
            t.status AS status,
            t.liquidez_status AS liquidez_status,
            t.provider AS provider,
            c.name AS client_name,
            c.last_name AS client_last_name,
            c.email AS client_email,
            c.id AS client_id,
            COALESCE(GROUP_CONCAT(DISTINCT con.CUPS), '') AS CUPS,
            COALESCE(GROUP_CONCAT(DISTINCT COALESCE(com.name, con.new_company)), '') AS new_companies,
            COALESCE(GROUP_CONCAT(DISTINCT con.old_company), '') AS old_companies,
            COALESCE(GROUP_CONCAT(DISTINCT con.plan), '') AS plans,
            COALESCE(GROUP_CONCAT(DISTINCT con.type), '') AS contract_types,
            COALESCE(GROUP_CONCAT(DISTINCT con.consumption), '') AS consumptions
        FROM tramites t
        LEFT JOIN clients c ON t.client_id = c.id
        LEFT JOIN contracts con ON t.id = con.tramite_id
        LEFT JOIN comercializadoras com ON com.id = con.new_company
        WHERE t.id IN (${idPlaceholders})
        GROUP BY t.id
        ORDER BY t.creation_date DESC, t.id DESC
      `;
}

/** Maps a hydration row into the client-facing TramiteRow shape. */
export function mapContractRow(row: Record<string, unknown>) {
  const parseArray = (value: string | null) =>
    value ? value.split(",").filter(Boolean) : [];

  const parseNumericArray = (value: string | null) =>
    value
      ? (value
          .split(",")
          .map((x) => {
            const num = Number(x);
            return !isNaN(num) ? num : null;
          })
          .filter((x) => x !== null) as number[])
      : [];

  return {
    id: row.id as string,
    creation_date: row.creation_date as string,
    activation_date: row.activation_date as string,
    renovation_date: row.renovation_date as string,
    collection_date: row.collection_date as string | null,
    payment_date: row.payment_date as string | null,
    rejected_date: row.rejected_date as string | null,
    sales_name: row.sales_name as string,
    client_name: `${row.client_name || ""} ${row.client_last_name || ""}`.trim(),
    client_email: row.client_email as string,
    client_id: row.client_id as string,
    CUPS: parseArray(row.CUPS as string),
    new_company: parseArray(row.new_companies as string),
    old_company: parseArray(row.old_companies as string),
    plan: parseArray(row.plans as string),
    contract_type: parseArray(row.contract_types as string),
    consumption: parseNumericArray(row.consumptions as string),
    comision_sales_person: row.comision_sales_person as number,
    comision: row.comision as number,
    status: row.status as string,
    liquidez_status: row.liquidez_status as string,
    provider: row.provider as string | null,
  };
}
