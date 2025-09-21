"use client";
import { TableLayout } from "@/core/components/table/TableLayout";
import { TableContent } from "@/core/components/table/TableContent";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { TramiteRow } from "@/tramites/types/tramite.types";
import { User } from "@/core/types";
import {
  ComercialTramiteColumns,
  SubComercialTramitesColumns,
  TramiteColumns,
} from "@/tramites/components/table/TramiteColumns";
import { useUser } from "@/core/contexts/UserContext";
import { useTablePagination } from "@/core/hooks/use-table-pagination";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/core/components/ui/card";
import { Search, AlertCircle } from "lucide-react";
import { Input } from "@/core/components/ui/input";
import { Button } from "@/core/components/ui/button";
import { showCustomToast } from "@/core/components/CustomToast";

interface Props {
  client_id: string;
}

// Custom hook to fetch tramites data
function useTramites(
  client_id: string,
  userData: User,
  pageIndex: number,
  pageSize: number | string
) {
  const [state, setState] = useState<{
    tramites: TramiteRow[];
    totalTramites: number;
    loading: boolean;
    error: string | null;
  }>({
    tramites: [],
    totalTramites: 0,
    loading: true,
    error: null,
  });

  const [filters, setFilters] = useState<{
    searchTerm: string;
    status: string | null;
  }>({
    searchTerm: "",
    status: null,
  });

  // Fetch tramites
  const fetchTramites = useCallback(async () => {
    if (!userData) return;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const params = new URLSearchParams();
      params.append("page", pageIndex.toString());
      params.append(
        "rowsPerPage",
        typeof pageSize === "number" ? pageSize.toString() : "Sin Límite"
      );
      params.append("user_id", userData.id);
      params.append("user_role", userData.role);
      params.append("clientFilter", client_id);
      params.append("searchTerm", filters.searchTerm);
      params.append("status", filters.status ?? "");

      const res = await fetch(`/api/v2/contracts?${params.toString()}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const { success, data, error, total } = await res.json();

      if (!success && error) {
        console.error("Error al obtener trámites:", error);
        setState((prev) => ({
          ...prev,
          tramites: [],
          totalTramites: 0,
          loading: false,
          error: "Error al cargar los trámites",
        }));
        return;
      }

      setState({
        tramites: data || [],
        totalTramites: total || 0,
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error("Error fetching data:", error);
      setState((prev) => ({
        ...prev,
        loading: false,
        error: "Error al conectar con el servidor",
      }));

      showCustomToast({
        title: "Error en la carga",
        message: "No se pudieron cargar los trámites",
        icon: AlertCircle,
        iconColor: "var(--danger-color)",
      });
    }
  }, [userData, pageIndex, pageSize, client_id, filters]);

  // Effect to fetch data when dependencies change
  useEffect(() => {
    if (userData) {
      fetchTramites();
    }
  }, [fetchTramites, userData]);

  // Set search term with debounce
  const setSearchTerm = useCallback((term: string) => {
    const timeoutId = setTimeout(() => {
      setFilters((prev) => ({ ...prev, searchTerm: term }));
    }, 300);

    return () => clearTimeout(timeoutId);
  }, []);

  // Set status filter
  const setStatusFilter = useCallback((status: string | null) => {
    setFilters((prev) => ({ ...prev, status }));
  }, []);

  return {
    ...state,
    refetch: fetchTramites,
    filters,
    setSearchTerm,
    setStatusFilter,
  };
}

// SearchInput component
const SearchInput = ({ onSearch }: { onSearch: (term: string) => void }) => {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
      <Input
        type="search"
        placeholder="Buscar trámites..."
        className="w-full pl-9 pr-4 py-2 text-sm border-gray-200 focus:border-gray-300 focus:ring-2 focus:ring-gray-100 rounded-lg"
        onChange={(e) => onSearch(e.target.value)}
      />
    </div>
  );
};

// Error state component
const ErrorState = ({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) => (
  <div className="flex flex-col items-center justify-center py-10 space-y-4">
    <AlertCircle className="h-12 w-12 text-red-500" />
    <div className="text-center">
      <h3 className="text-lg font-medium">Error al cargar los datos</h3>
      <p className="text-sm text-muted-foreground mt-1">{message}</p>
    </div>
    <Button onClick={onRetry} variant="outline">
      Reintentar
    </Button>
  </div>
);

export function ClientTramitesTable({ client_id }: Props) {
  const { userData } = useUser();
  const { pageIndex, pageSize, setPageIndex, setPageSize } = useTablePagination(
    `client-tramites-${client_id}`
  );

  // Get columns based on user role
  const columns = useMemo(() => {
    if (!userData) return [];

    if (userData.role === "2" && userData.super_id) {
      return SubComercialTramitesColumns;
    } else if (userData.role === "2" && !userData.super_id) {
      return ComercialTramiteColumns;
    } else if (userData.role === "1" || userData.role === "admin") {
      return TramiteColumns;
    }
    return [];
  }, [userData]);

  // Use custom hook for data fetching
  const {
    tramites,
    totalTramites,
    loading,
    error,
    refetch,
    filters,
    setSearchTerm,
  } = useTramites(client_id, userData as User, pageIndex, pageSize);

  // Table configuration
  const tableConfig = useMemo(
    () => ({
      data: tramites,
      columns,
      getCoreRowModel: getCoreRowModel(),
      getSortedRowModel: getSortedRowModel(),
      getFilteredRowModel: getFilteredRowModel(),
      state: {
        globalFilter: filters.searchTerm,
      },
    }),
    [tramites, columns, filters.searchTerm]
  );

  // Create table instance
  const table = useReactTable(tableConfig);

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-semibold text-gray-900">
              Trámites Asociados
            </CardTitle>
            <CardDescription className="text-sm text-gray-500">
              Historial completo de trámites del cliente
              {totalTramites > 0 && (
                <span className="font-medium text-gray-700 ml-1">
                  • {totalTramites} registros
                </span>
              )}
            </CardDescription>
          </div>
          <div className="w-full sm:w-auto">
            <SearchInput onSearch={setSearchTerm} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white">
            <TableLayout>
              <TableContent
                table={table}
                columns={columns}
                rowsPerPage={pageSize}
                setPageSize={setPageSize}
                setPageIndex={setPageIndex}
                pageIndex={pageIndex}
                total={totalTramites}
                loading={loading}
              />
            </TableLayout>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
