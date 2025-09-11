import { useMemo, useState } from "react";
import {
  type ColumnDef,
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  type SortingState,
  VisibilityState,
} from "@tanstack/react-table";

interface UseTableConfigParams<TData, TValue = unknown> {
  data: TData[];
  columns: ColumnDef<TData, TValue>[];
}

export function useTableConfig<TData, TValue = unknown>({
  data,
  columns,
}: UseTableConfigParams<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const tableConfig = useMemo(
    () => ({
      data,
      columns,
      getCoreRowModel: getCoreRowModel(),
      getSortedRowModel: getSortedRowModel(),
      getFilteredRowModel: getFilteredRowModel(),
      onSortingChange: setSorting,
      onColumnVisibilityChange: setColumnVisibility,
      state: {
        sorting,
        columnVisibility,
      },
    }),
    [data, columns, sorting, columnVisibility]
  );

  const table = useReactTable(tableConfig);

  return {
    table,
    sorting,
    setSorting,
    columnVisibility,
    setColumnVisibility,
  };
}
