import { CardHeader } from "@/components/ui/card";
import { type Table } from "@tanstack/react-table";

interface TableHeaderProps<TData> {
  table: Table<TData>;
  pagination: {
    pageIndex: number;
    pageSize: number;
  };
  setPagination: (value: { pageIndex: number; pageSize: number }) => void;
}

export function TableHeader<TData>({
  table,
  pagination,
  setPagination,
}: TableHeaderProps<TData>) {
  return (
    <CardHeader className="space-y-6">
      <div className="flex justify-between items-center">
        <span className="text-default-400 text-small">
          {table.getFilteredRowModel().rows.length} trámites
        </span>
        <RowsPerPageSelect
          pageSize={pagination.pageSize}
          setPagination={setPagination}
        />
      </div>
    </CardHeader>
  );
}

interface RowsPerPageSelectProps {
  pageSize: number;
  setPagination: (value: { pageIndex: number; pageSize: number }) => void;
}

function RowsPerPageSelect({
  pageSize,
  setPagination,
}: RowsPerPageSelectProps) {
  return (
    <label className="flex items-center text-default-400 text-small">
      Filas por página:
      <select
        name="rowsPerPage"
        defaultValue={pageSize}
        className="bg-transparent outline-none text-default-400 text-small"
        onChange={(e) => {
          setPagination({
            pageIndex: 1,
            pageSize: parseInt(e.target.value),
          });
        }}
      >
        <option value="15">15</option>
        <option value="25">25</option>
        <option value="50">50</option>
      </select>
    </label>
  );
}
