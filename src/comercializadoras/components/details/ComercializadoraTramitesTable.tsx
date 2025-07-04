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
import { TramiteRow } from "@/tramites/types";
import { User } from "@/core/types";
import {
  ComercialTramiteColumns,
  SubComercialTramitesColumns,
  TramiteColumns,
} from "@/tramites/components/table/TramiteColumns";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { showCustomToast } from "@/core/components/CustomToast";

interface Props {
  name: string;
  userData: User;
}

// Custom hook to fetch tramites data
function useTramites(
  name: string,
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

  // Fetch tramites
  const fetchTramites = useCallback(async () => {
    if (!userData) return;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const res = await fetch(`/api/tramites/get/paginated-tramites`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          page: pageIndex,
          rowsPerPage: typeof pageSize === "number" ? pageSize : "Sin Límite",
          user_id: userData.id,
          user_role: userData.role,
          companyFilter: [name],
        }),
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
  }, [userData, pageIndex, pageSize, name]);

  // Effect to fetch data when dependencies change
  useEffect(() => {
    if (userData) {
      fetchTramites();
    }
  }, [fetchTramites, userData]);

  return {
    ...state,
    refetch: fetchTramites,
  };
}

// Error state component
const ErrorState = ({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) => (
  <div className="flex flex-col items-center justify-center py-16 space-y-6">
    <div className="w-20 h-20 bg-red-50 rounded-2xl flex items-center justify-center">
      <AlertCircle className="h-10 w-10 text-red-500" />
    </div>
    <div className="text-center space-y-2">
      <h3 className="text-lg font-semibold text-gray-900">
        Error al cargar los datos
      </h3>
      <p className="text-sm text-gray-500 max-w-md">{message}</p>
    </div>
    <Button onClick={onRetry} variant="outline" className="gap-2">
      <RefreshCw className="h-4 w-4" />
      Reintentar
    </Button>
  </div>
);

export function ComercializadoraTramitesTable({ name, userData }: Props) {
  const [pageSize, setPageSize] = useState<number | string>(15);
  const [pageIndex, setPageIndex] = useState(1);

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
  const { tramites, totalTramites, loading, error, refetch } = useTramites(
    name,
    userData as User,
    pageIndex,
    pageSize
  );

  // Table configuration
  const tableConfig = useMemo(
    () => ({
      data: tramites,
      columns,
      getCoreRowModel: getCoreRowModel(),
      getSortedRowModel: getSortedRowModel(),
      getFilteredRowModel: getFilteredRowModel(),
    }),
    [tramites, columns]
  );

  // Create table instance
  const table = useReactTable(tableConfig);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Trámites Asociados
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Listado de todos los trámites de la comercializadora
            {totalTramites > 0 && (
              <span className="font-medium text-primary-600 ml-1">
                ({totalTramites} total
                {totalTramites !== 1 ? "es" : ""})
              </span>
            )}
          </p>
        </div>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
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
    </div>
  );
}
