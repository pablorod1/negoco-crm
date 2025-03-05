"use client";

import { Button, Popover, PopoverContent, PopoverTrigger } from "@heroui/react";
import { formatDate } from "@/lib/core/format";
import { ColumnDef } from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUpDown,
  ArrowUpIcon,
  Copy,
  EllipsisVertical,
} from "lucide-react";
import { Chip } from "@heroui/chip";
import { TramiteVM } from "@/lib/core/types";
import EditTramiteDialog from "../EditTramiteDialog";
import { copyLink } from "@/lib/core/utils";

export const LiquidezColumns: ColumnDef<TramiteVM>[] = [
  {
    id: "id",
    accessorKey: "id",
    header: "ID",
  },
  {
    id: "Fecha de Creación",
    accessorKey: "creation_date",
    header: ({ column }) => {
      return (
        <Button
          variant="faded"
          size="sm"
          className="font-bold flex justify-between w-full m-0 border-0 bg-transparent text-[var(--primary-color-950)]"
          onPress={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Creación
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
      if (!row.original.creation_date) return "---";
      return <span>{formatDate(row.original.creation_date)}</span>;
    },
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.creation_date;
      const b = rowB.original.creation_date;

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
    accessorKey: "company",
    header: "Compañía",
    cell: ({ row }) => {
      return (
        <div className="flex flex-col">
          {row.original.company.map((company, index) => (
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
    id: "Liquidez",
    accessorKey: "liquidez_status",
    header: ({}) => {
      return <span className="flex justify-end text-end">Liquidez</span>;
    },
    cell: ({ row }) => {
      if (!row.original.liquidez_status) return "---";
      return (
        <div className="flex justify-end">
          <Chip
            size="sm"
            variant="flat"
            color={
              row.original.liquidez_status === "Pendiente de Cobro"
                ? "warning"
                : row.original.liquidez_status ===
                  "Cobrado por Comercializadora"
                ? "primary"
                : row.original.liquidez_status === "Pagado al Comercial"
                ? "success"
                : "default"
            }
          >
            {row.original.liquidez_status === "Pendiente de Cobro"
              ? "Pendiente"
              : row.original.liquidez_status === "Cobrado por Comercializadora"
              ? "Cobrado"
              : row.original.liquidez_status === "Pagado al comercial"
              ? "Pagado"
              : "default"}
          </Chip>
        </div>
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      return (
        <Popover placement="bottom">
          <PopoverTrigger asChild>
            <Button color="default" variant="light" isIconOnly>
              <EllipsisVertical size={20} />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px]">
            <EditTramiteDialog tramite_id={row.original.id} />
          </PopoverContent>
        </Popover>
      );
    },
  },
];
