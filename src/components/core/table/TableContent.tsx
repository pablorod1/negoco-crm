import { CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Spinner } from "@heroui/spinner";
import { motion } from "framer-motion";
import {
  ColumnDef,
  flexRender,
  type Table as TableType,
} from "@tanstack/react-table";

interface TableContentProps<TData, TValue> {
  table: TableType<TData>;
  loading: boolean;
  columns: ColumnDef<TData, TValue>[];
}

export function TableContent<TData, TValue>({
  table,
  loading,
  columns,
}: TableContentProps<TData, TValue>) {
  return (
    <CardContent className="p-0">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className="py-2 text-xs font-bold text-[var(--primary-color-950)]"
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows && table.getRowModel().rows.length > 0 ? (
            table.getRowModel().rows.map((row, index) => (
              <motion.tr
                key={row.id}
                className={`${
                  index % 2 === 0 ? "bg-[var(--primary-color-50)]" : "bg-white"
                } `}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="text-sm text-nowrap">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </motion.tr>
            ))
          ) : loading ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className=" h-64 text-center text-gray-500"
              >
                <Spinner
                  variant="gradient"
                  size="lg"
                  color="primary"
                  className="text-base font-bold"
                />
                <div className="flex flex-col items-center">
                  <span className="text-lg font-bold">Cargando datos...</span>
                  <span className="text-sm">
                    Por favor, espere un momento mientras se cargan los datos.
                  </span>
                </div>
              </TableCell>
            </TableRow>
          ) : !loading &&
            table.getRowModel().rows &&
            table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-24 text-center text-gray-500"
              >
                No se encontraron resultados
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </CardContent>
  );
}
