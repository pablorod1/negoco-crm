"use client";
import { TableLayout } from "@/components/core/table/TableLayout";
import { TableContent } from "@/components/core/table/TableContent";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { TramiteRow, User } from "@/lib/core/types";
import {
  ComercialTramiteColumns,
  SubComercialTramitesColumns,
  TramiteColumns,
} from "@/components/tramites/table/TramiteColumns";
import { useUser } from "@/lib/contexts/UserContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { showCustomToast } from "@/components/core/CustomToast";

interface Props {
  name: string;
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

export function ComercializadoraTramitesTable({ name }: Props) {
  const { userData } = useUser();
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
    <Card>
      <CardHeader className="flex flex-row items-center">
        <div>
          <CardTitle>Trámites Asociados</CardTitle>
          <CardDescription>
            Listado de todos los trámites del cliente.
            {totalTramites > 0 && (
              <span className="font-medium text-primary">
                {" "}
                ({totalTramites})
              </span>
            )}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : (
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
        )}
      </CardContent>
    </Card>
  );
}
