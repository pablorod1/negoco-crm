"use client";

import { formatDate } from "@/lib/core/format";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowDown, ArrowUpDown, ArrowUpIcon, Copy } from "lucide-react";
import { Status, TramiteRow } from "@/lib/core/types";
import { copyLink } from "@/lib/core/utils";
import LiquidezDropdown from "./LiquidezDropdown";
import { Button } from "@/components/ui/button";
import { getStatusBadge } from "@/lib/hooks/use-status-badge";

export const LiquidezColumns: ColumnDef<TramiteRow>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <div className="flex items-center justify-center">
        <input
          type="checkbox"
          className="w-4 h-4"
          onChange={table.getToggleAllRowsSelectedHandler()}
          checked={table.getIsAllRowsSelected()}
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <input
          type="checkbox"
          className="w-4 h-4"
          onChange={row.getToggleSelectedHandler()}
          checked={row.getIsSelected()}
        />
      </div>
    ),
  },
  {
    id: "id",
    accessorKey: "id",
    header: "ID",
  },
  {
    id: "Fecha de Activación",
    accessorKey: "activation_date",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          size="sm"
          className="font-bold flex justify-between w-full m-0 border-0 bg-transparent text-[var(--primary-color-950)]"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Activación
          {column.getIsSorted() === "asc" ? (
            <ArrowUpIcon className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === "desc" ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      );
    },
    cell: ({ row }) => {
      if (!row.original.activation_date) return "---";
      return <span>{formatDate(row.original.activation_date)}</span>;
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
          className="font-bold flex justify-between w-full m-0 border-0 bg-transparent text-[var(--primary-color-950)]"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Cobrado
          {column.getIsSorted() === "asc" ? (
            <ArrowUpIcon className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === "desc" ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      );
    },
    cell: ({ row }) => {
      if (!row.original.collection_date) return "---";
      return <span>{formatDate(row.original.collection_date)}</span>;
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
          className="font-bold flex justify-between w-full m-0 border-0 bg-transparent text-[var(--primary-color-950)]"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Pago
          {column.getIsSorted() === "asc" ? (
            <ArrowUpIcon className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === "desc" ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      );
    },
    cell: ({ row }) => {
      if (!row.original.payment_date) return "---";
      return <span>{formatDate(row.original.payment_date)}</span>;
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
    header: "Comercial",
  },
  {
    id: "Cliente",
    accessorKey: "client_name",
    header: "Cliente",
    cell: ({ row }) => {
      return (
        <div className="flex flex-col">
          <span>{row.original.client_name}</span>
          <span className="text-xs text-gray-500">
            {row.original.client_email}
          </span>
        </div>
      );
    },
  },
  {
    id: "CUPS",
    accessorKey: "CUPS",
    header: "CUPS",
    cell: ({ row }) => {
      return (
        <div className="flex flex-col">
          {row.original.CUPS.map((CUPS, index) => (
            <div
              onClick={() => copyLink(CUPS)}
              key={index}
              className="flex items-center gap-2 group cursor-pointer"
            >
              <span>{CUPS}</span>
              <Copy className="w-4 h-4 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            </div>
          ))}
        </div>
      );
    },
  },
  {
    id: "Compañía",
    accessorKey: "new_company",
    header: "Compañía",
    cell: ({ row }) => {
      return (
        <div className="flex flex-col">
          {row.original.new_company.map((company, index) => (
            <span
              key={index}
              className="text-ellipsis overflow-hidden whitespace-nowrap max-w-44 w-full"
            >
              {company}
            </span>
          ))}
        </div>
      );
    },
  },
  {
    id: "Comisión",
    accessorKey: "comision",
    header: ({}) => {
      return <span className="flex justify-end text-end">Comisión</span>;
    },
    cell: ({ row }) => {
      return (
        <div className="flex justify-end me-2">
          <span>
            {row.original.comision ? `${row.original.comision}€` : "---"}
          </span>
        </div>
      );
    },
  },
  {
    id: "Comisión Comercial",
    accessorKey: "comision_sales_person",
    header: ({}) => {
      return (
        <span className="flex justify-end text-end">Comisión Comercial</span>
      );
    },
    cell: ({ row }) => {
      return (
        <div className="flex justify-end me-2">
          <span>
            {row.original.comision_sales_person
              ? `${row.original.comision_sales_person}€`
              : "---"}
          </span>
        </div>
      );
    },
  },
  {
    id: "Estado",
    accessorKey: "status",
    header: "Estado",
    cell: ({ row }) => {
      return getStatusBadge(row.original.status as Status);
    },
  },
  {
    id: "Liquidez",
    accessorKey: "liquidez_status",
    header: ({}) => {
      return <span className="flex justify-end text-end">Estado Liquidez</span>;
    },
    cell: ({ row }) => {
      if (!row.original.liquidez_status)
        return <div className="flex justify-end">---</div>;
      return (
        <div className="flex justify-end">
          {getStatusBadge(row.original.liquidez_status as Status)}
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
