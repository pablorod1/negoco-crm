"use client";

import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowDown, ArrowUpDown, ArrowUpIcon } from "lucide-react";
import { Tooltip } from "@heroui/tooltip";
import { Chip } from "@heroui/chip";

// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.
export type Tramite = {
  id: string;
  creationDate: string;
  renovationDate: string;
  salesPersonName: string;
  clientName: string;
  CUPS: string;
  company: string;
  plan: string;
  contractType: string;
  consumption: number;
  comision_salesPerson: number;
  comision: number;
  status: string;
  liquidez_status: string;
};

export const columns: ColumnDef<Tramite>[] = [
  {
    accessorKey: "id",
    header: "ID",
  },
  {
    accessorKey: "creationDate",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          size="sm"
          className="font-bold flex justify-between w-full m-0"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
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
      const formatted = formatDate(row.original.creationDate);

      return <span>{formatted}</span>;
    },
  },
  {
    accessorKey: "renovationDate",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          size="sm"
          className="font-bold "
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Renovación
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
      const formatted = formatDate(row.original.renovationDate);

      return <span>{formatted}</span>;
    },
  },
  {
    accessorKey: "salesPersonName",
    header: "Comercial",
  },
  {
    accessorKey: "clientName",
    header: "Cliente",
  },
  {
    accessorKey: "CUPS",
    header: "CUPS",
    cell: ({ row }) => {
      return (
        <Tooltip
          content={row.original.CUPS}
          className="bg-[var(--primary-color-500)] rounded-full text-white "
          radius="lg"
        >
          <span className="block max-w-36 w-full overflow-hidden text-ellipsis whitespace-nowrap">
            {row.original.CUPS}
          </span>
        </Tooltip>
      );
    },
  },
  {
    accessorKey: "company",
    header: "Compañía",
  },
  {
    accessorKey: "plan",
    header: "Plan",
  },
  {
    accessorKey: "contractType",
    header: "Contrato",
  },
  {
    accessorKey: "consumption",
    header: "Consumo",
    cell: ({ row }) => {
      return (
        <div className="flex justify-end me-2">
          <span>{row.original.consumption}kWh</span>
        </div>
      );
    },
  },
  {
    accessorKey: "comision",
    header: "Comisión",
    cell: ({ row }) => {
      return (
        <div className="flex justify-end me-2">
          <span>{row.original.comision}€</span>
        </div>
      );
    },
  },
  {
    accessorKey: "comision_salesPerson",
    header: "C. Comercial",
    cell: ({ row }) => {
      return (
        <div className="flex justify-end me-2">
          <span>{row.original.comision_salesPerson}€</span>
        </div>
      );
    },
  },

  {
    accessorKey: "status",
    header: "Estado",
    cell: ({ row }) => {
      return (
        <Chip size="sm" variant="flat" color="success">
          {row.original.status === "active" ? "Activo" : "Inactivo"}
        </Chip>
      );
    },
  },
  {
    accessorKey: "liquidez_status",
    header: "Liquidez",
    cell: ({ row }) => {
      return (
        <Chip size="sm" variant="flat" color="success">
          {row.original.status === "active" ? "Activo" : "Inactivo"}
        </Chip>
      );
    },
  },
];
