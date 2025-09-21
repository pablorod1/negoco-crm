"use client";

import { formatDate, formatUUID } from "@/core/utils/format";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowDown, ArrowUpDown, ArrowUpIcon, Copy } from "lucide-react";
import { Status, TramiteRow } from "@/tramites/types";
import { copyLink } from "@/core/utils";
import LiquidezDropdown from "./LiquidezDropdown";
import { Button } from "@/core/components/ui/button";
import { getStatusBadge } from "@/core/hooks/use-status-badge";

export const LiquidezColumns: ColumnDef<TramiteRow>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <div className="flex items-center justify-center">
        <input
          type="checkbox"
          className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 focus:ring-2 focus:ring-offset-1"
          onChange={table.getToggleAllRowsSelectedHandler()}
          checked={table.getIsAllRowsSelected()}
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <input
          type="checkbox"
          className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 focus:ring-2 focus:ring-offset-1"
          onChange={row.getToggleSelectedHandler()}
          checked={row.getIsSelected()}
        />
      </div>
    ),
  },
  {
    id: "id",
    accessorKey: "id",
    header: () => <span className="text-gray-600 font-medium text-xs">ID</span>,
    cell: ({ row }) => {
      return (
        <span className="text-gray-500 text-sm font-mono">
          {formatUUID(row.original.id)}
        </span>
      );
    },
  },
  {
    id: "Fecha de Activación",
    accessorKey: "activation_date",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 border-0 justify-between w-full"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          <span className="text-xs">Activación</span>
          {column.getIsSorted() === "asc" ? (
            <ArrowUpIcon className="ml-2 h-3 w-3" />
          ) : column.getIsSorted() === "desc" ? (
            <ArrowDown className="ml-2 h-3 w-3" />
          ) : (
            <ArrowUpDown className="ml-2 h-3 w-3 opacity-50" />
          )}
        </Button>
      );
    },
    cell: ({ row }) => {
      if (!row.original.activation_date)
        return <span className="text-gray-400 text-sm">---</span>;
      return (
        <span className="text-gray-700 text-sm">
          {formatDate(row.original.activation_date)}
        </span>
      );
    },
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.activation_date;
      const b = rowB.original.activation_date;

      if (!a && !b) return 0;
      if (!a) return 1;
      if (!b) return -1;

      return new Date(a).getTime() - new Date(b).getTime();
    },
  },
  {
    id: "Fecha de Cobro",
    accessorKey: "collection_date",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 border-0 justify-between w-full"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          <span className="text-xs">Cobrado</span>
          {column.getIsSorted() === "asc" ? (
            <ArrowUpIcon className="ml-2 h-3 w-3" />
          ) : column.getIsSorted() === "desc" ? (
            <ArrowDown className="ml-2 h-3 w-3" />
          ) : (
            <ArrowUpDown className="ml-2 h-3 w-3 opacity-50" />
          )}
        </Button>
      );
    },
    cell: ({ row }) => {
      if (!row.original.collection_date)
        return <span className="text-gray-400 text-sm">---</span>;
      return (
        <span className="text-gray-700 text-sm">
          {formatDate(row.original.collection_date)}
        </span>
      );
    },
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.collection_date;
      const b = rowB.original.collection_date;

      if (!a && !b) return 0;
      if (!a) return 1;
      if (!b) return -1;

      return new Date(a).getTime() - new Date(b).getTime();
    },
  },
  {
    id: "Fecha de Pago",
    accessorKey: "payment_date",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 border-0 justify-between w-full"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          <span className="text-xs">Pago</span>
          {column.getIsSorted() === "asc" ? (
            <ArrowUpIcon className="ml-2 h-3 w-3" />
          ) : column.getIsSorted() === "desc" ? (
            <ArrowDown className="ml-2 h-3 w-3" />
          ) : (
            <ArrowUpDown className="ml-2 h-3 w-3 opacity-50" />
          )}
        </Button>
      );
    },
    cell: ({ row }) => {
      if (!row.original.payment_date)
        return <span className="text-gray-400 text-sm">---</span>;
      return (
        <span className="text-gray-700 text-sm">
          {formatDate(row.original.payment_date)}
        </span>
      );
    },
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.payment_date;
      const b = rowB.original.payment_date;

      if (!a && !b) return 0;
      if (!a) return 1;
      if (!b) return -1;

      return new Date(a).getTime() - new Date(b).getTime();
    },
  },
  {
    id: "Comercial",
    accessorKey: "sales_name",
    header: () => (
      <span className="text-gray-600 font-medium text-xs">Comercial</span>
    ),
    cell: ({ row }) => (
      <span className="text-gray-800 text-sm font-medium">
        {row.original.sales_name}
      </span>
    ),
  },
  {
    id: "Cliente",
    accessorKey: "client_name",
    header: () => (
      <span className="text-gray-600 font-medium text-xs">Cliente</span>
    ),
    cell: ({ row }) => {
      return (
        <div className="flex flex-col space-y-1">
          <span className="text-gray-900 text-sm font-medium">
            {row.original.client_name}
          </span>
          <span className="text-gray-500 text-xs">
            {row.original.client_email}
          </span>
        </div>
      );
    },
  },
  {
    id: "CUPS",
    accessorKey: "CUPS",
    header: () => (
      <span className="text-gray-600 font-medium text-xs">CUPS</span>
    ),
    cell: ({ row }) => {
      return (
        <div className="flex flex-col space-y-1">
          {row.original.CUPS.map((CUPS, index) => (
            <div
              onClick={() => copyLink(CUPS)}
              key={index}
              className="flex items-center gap-2 group cursor-pointer p-1 rounded hover:bg-gray-50 transition-colors"
            >
              <span className="text-gray-700 text-sm font-mono">{CUPS}</span>
              <Copy className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            </div>
          ))}
        </div>
      );
    },
  },
  {
    id: "Compañía",
    accessorKey: "new_company",
    header: () => (
      <span className="text-gray-600 font-medium text-xs">Compañía</span>
    ),
    cell: ({ row }) => {
      return (
        <div className="flex flex-col space-y-1">
          {row.original.new_company.map((company, index) => (
            <span
              key={index}
              className="text-gray-700 text-sm text-ellipsis overflow-hidden whitespace-nowrap max-w-44 w-full"
            >
              {company}
            </span>
          ))}
        </div>
      );
    },
  },
  {
    id: "Proveedor",
    accessorKey: "provider",
    header: () => {
      return (
        <span className="text-gray-600 font-medium text-xs flex justify-end">
          Proveedor
        </span>
      );
    },
    cell: ({ row }) => {
      return (
        <div className="flex justify-end">
          <span className="text-gray-700 text-sm">
            {row.original.provider || "---"}
          </span>
        </div>
      );
    },
  },
  {
    id: "Comisión",
    accessorKey: "comision",
    header: () => {
      return (
        <span className="text-gray-600 font-medium text-xs flex justify-end">
          Comisión
        </span>
      );
    },
    cell: ({ row }) => {
      return (
        <div className="flex justify-end">
          <span className="text-gray-900 text-sm font-semibold">
            {row.original.comision ? (
              `${row.original.comision}€`
            ) : (
              <span className="text-gray-400">---</span>
            )}
          </span>
        </div>
      );
    },
  },
  {
    id: "Comisión Comercial",
    accessorKey: "comision_sales_person",
    header: () => {
      return (
        <span className="text-gray-600 font-medium text-xs flex justify-end">
          Comisión Comercial
        </span>
      );
    },
    cell: ({ row }) => {
      return (
        <div className="flex justify-end">
          <span className="text-gray-900 text-sm font-semibold">
            {row.original.comision_sales_person ? (
              `${row.original.comision_sales_person}€`
            ) : (
              <span className="text-gray-400">---</span>
            )}
          </span>
        </div>
      );
    },
  },
  {
    id: "Estado",
    accessorKey: "status",
    header: () => (
      <span className="text-gray-600 font-medium text-xs">Estado</span>
    ),
    cell: ({ row }) => {
      return getStatusBadge(row.original.status as Status, "general");
    },
  },
  {
    id: "Liquidez",
    accessorKey: "liquidez_status",
    header: () => {
      return (
        <span className="text-gray-600 font-medium text-xs flex justify-end">
          Estado Liquidez
        </span>
      );
    },
    cell: ({ row }) => {
      if (!row.original.liquidez_status)
        return (
          <div className="flex justify-end">
            <span className="text-gray-400 text-sm">---</span>
          </div>
        );
      return (
        <div className="flex justify-end">
          {getStatusBadge(row.original.liquidez_status as Status, "liquidez")}
        </div>
      );
    },
  },
  {
    accessorKey: "actions",
    header: "",
    cell: ({ row }) => {
      return <LiquidezDropdown tramite={row.original} />;
    },
  },
];
