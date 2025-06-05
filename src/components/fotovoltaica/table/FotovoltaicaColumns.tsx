import TooltipComponent from "@/components/core/TooltipComponent";
import { Button } from "@/components/ui/button";
import { formatComission, formatDate } from "@/lib/core/format";
import { FotovoltaicaStatus, FotovoltaicaVM } from "@/lib/core/types";
import { getStatusBadge } from "@/lib/hooks/use-status-badge";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowDown, ArrowUpDown, ArrowUpIcon } from "lucide-react";
import FotovoltaicaDropdown from "./FotovoltaicaDropdown";
import {
  FOTOVOLTAICA_CLIENT_TYPES,
  FOTOVOLTAICA_TYPES,
} from "@/lib/core/const";

export const SubcomercialFotovoltaicaColumns: ColumnDef<FotovoltaicaVM>[] = [
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
          variant="ghost"
          size="sm"
          className="font-bold flex justify-between w-full m-0 border-0 bg-transparent text-[var(--primary-color-950)]"
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
    id: "Comercial",
    accessorKey: "user_name",
    header: "Comercial",
    cell: ({ row }) => {
      return (
        <TooltipComponent
          content={
            <div className="flex flex-col gap-1">
              <span>{row.original.user.name}</span>
              <span className="text-xs text-gray-100">
                {row.original.user.email}
              </span>
            </div>
          }
        >
          <div className="flex flex-col">
            <span className="block max-w-36 w-full text-ellipsis overflow-hidden whitespace-nowrap">
              {row.original.user.name}
            </span>
            <span className="text-xs text-gray-500 block max-w-32 text-ellipsis overflow-hidden whitespace-nowrap">
              {row.original.user.email}
            </span>
          </div>
        </TooltipComponent>
      );
    },
  },
  {
    id: "Cliente",
    accessorKey: "client",
    header: "Cliente",
    cell: ({ row }) => {
      return (
        <div className="flex flex-col">
          <span>{row.original.client}</span>
          <span className="text-xs text-gray-500">
            {FOTOVOLTAICA_CLIENT_TYPES.find(
              (type) => type.value === row.original.client_type
            )?.label || row.original.client_type}
          </span>
        </div>
      );
    },
  },
  {
    id: "Ubicación",
    accessorKey: "location",
    header: "Ubicación",
    cell: ({ row }) => {
      return (
        <a
          href={row.original.location}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800"
          title="Ver ubicación en Google Maps"
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          📍 Ver ubicación
        </a>
      );
    },
  },
  {
    id: "Tipo",
    accessorKey: "type",
    header: "Tipo",
    cell: ({ row }) => {
      return (
        <span className="block max-w-36 w-full text-ellipsis overflow-hidden whitespace-nowrap">
          {FOTOVOLTAICA_TYPES.find((type) => type.value === row.original.type)
            ?.label || row.original.type}
        </span>
      );
    },
  },
  {
    id: "Estado",
    accessorKey: "status",
    header: "Estado",
    cell: ({ row }) => {
      return getStatusBadge(row.original.status as FotovoltaicaStatus);
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      return <FotovoltaicaDropdown fotovoltaica={row.original} />;
    },
  },
];

export const ComercialFotovoltaicaColumns: ColumnDef<FotovoltaicaVM>[] = [
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
          variant="ghost"
          size="sm"
          className="font-bold flex justify-between w-full m-0 border-0 bg-transparent text-[var(--primary-color-950)]"
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
    id: "Comercial",
    accessorKey: "user_name",
    header: "Comercial",
    cell: ({ row }) => {
      return (
        <TooltipComponent
          content={
            <div className="flex flex-col gap-1">
              <span>{row.original.user.name}</span>
              <span className="text-xs text-gray-100">
                {row.original.user.email}
              </span>
            </div>
          }
        >
          <div className="flex flex-col">
            <span className="block max-w-36 w-full text-ellipsis overflow-hidden whitespace-nowrap">
              {row.original.user.name}
            </span>
            <span className="text-xs text-gray-500 block max-w-32 text-ellipsis overflow-hidden whitespace-nowrap">
              {row.original.user.email}
            </span>
          </div>
        </TooltipComponent>
      );
    },
  },
  {
    id: "Cliente",
    accessorKey: "client",
    header: "Cliente",
    cell: ({ row }) => {
      return (
        <div className="flex flex-col">
          <span>{row.original.client}</span>
          <span className="text-xs text-gray-500">
            {FOTOVOLTAICA_CLIENT_TYPES.find(
              (type) => type.value === row.original.client_type
            )?.label || row.original.client_type}
          </span>
        </div>
      );
    },
  },
  {
    id: "Ubicación",
    accessorKey: "location",
    header: "Ubicación",
    cell: ({ row }) => {
      return (
        <a
          href={row.original.location}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800"
          title="Ver ubicación en Google Maps"
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          📍 Ver ubicación
        </a>
      );
    },
  },
  {
    id: "Tipo",
    accessorKey: "type",
    header: "Tipo",
    cell: ({ row }) => {
      return (
        <span className="block max-w-36 w-full text-ellipsis overflow-hidden whitespace-nowrap">
          {FOTOVOLTAICA_TYPES.find((type) => type.value === row.original.type)
            ?.label || row.original.type}
        </span>
      );
    },
  },
  {
    id: "Comisión",
    accessorKey: "comision_sales_person",
    header: "Comisión",
    cell: ({ row }) => {
      return (
        <div className="flex justify-end me-2">
          <span>
            {row.original.comision_sales_person
              ? formatComission(row.original.comision_sales_person)
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
      return getStatusBadge(row.original.status as FotovoltaicaStatus);
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      return <FotovoltaicaDropdown fotovoltaica={row.original} />;
    },
  },
];

export const FotovoltaicaColumns: ColumnDef<FotovoltaicaVM>[] = [
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
          variant="ghost"
          size="sm"
          className="font-bold flex justify-between w-full m-0 border-0 bg-transparent text-[var(--primary-color-950)]"
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
    id: "Comercial",
    accessorKey: "user_name",
    header: "Comercial",
    cell: ({ row }) => {
      return (
        <TooltipComponent
          content={
            <div className="flex flex-col gap-1">
              <span>{row.original.user.name}</span>
              <span className="text-xs text-gray-100">
                {row.original.user.email}
              </span>
            </div>
          }
        >
          <div className="flex flex-col">
            <span className="block max-w-36 w-full text-ellipsis overflow-hidden whitespace-nowrap">
              {row.original.user.name}
            </span>
            <span className="text-xs text-gray-500 block max-w-32 text-ellipsis overflow-hidden whitespace-nowrap">
              {row.original.user.email}
            </span>
          </div>
        </TooltipComponent>
      );
    },
  },
  {
    id: "Cliente",
    accessorKey: "client",
    header: "Cliente",
    cell: ({ row }) => {
      return (
        <div className="flex flex-col">
          <span>{row.original.client}</span>
          <span className="text-xs text-gray-500">
            {FOTOVOLTAICA_CLIENT_TYPES.find(
              (type) => type.value === row.original.client_type
            )?.label || row.original.client_type}
          </span>
        </div>
      );
    },
  },
  {
    id: "Ubicación",
    accessorKey: "location",
    header: "Ubicación",
    cell: ({ row }) => {
      return (
        <a
          href={row.original.location}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800"
          title="Ver ubicación en Google Maps"
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          📍 Ver ubicación
        </a>
      );
    },
  },
  {
    id: "Tipo",
    accessorKey: "type",
    header: "Tipo",
    cell: ({ row }) => {
      return (
        <span className="block max-w-36 w-full text-ellipsis overflow-hidden whitespace-nowrap">
          {FOTOVOLTAICA_TYPES.find((type) => type.value === row.original.type)
            ?.label || row.original.type}
        </span>
      );
    },
  },
  {
    id: "Comisión",
    accessorKey: "comision",
    header: "Comisión",
    cell: ({ row }) => {
      return (
        <div className="flex justify-end me-2">
          <span>
            {row.original.comision
              ? formatComission(row.original.comision)
              : "---"}
          </span>
        </div>
      );
    },
  },
  {
    id: "Comisión Comercial",
    accessorKey: "comision_sales_person",
    header: "Comisión Comercial",
    cell: ({ row }) => {
      return (
        <div className="flex justify-end me-2">
          <span>
            {row.original.comision_sales_person
              ? formatComission(row.original.comision_sales_person)
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
      return getStatusBadge(row.original.status as FotovoltaicaStatus);
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      return <FotovoltaicaDropdown fotovoltaica={row.original} />;
    },
  },
];
