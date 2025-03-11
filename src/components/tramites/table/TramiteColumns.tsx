"use client";

import { Button } from "@heroui/button";
import { formatDate } from "@/lib/core/format";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowDown, ArrowUpDown, ArrowUpIcon, Copy } from "lucide-react";
import { Tooltip } from "@heroui/tooltip";
import { Chip } from "@heroui/chip";
import { TramiteVM } from "@/lib/core/types";
import { copyLink } from "@/lib/core/utils";
import TramiteDropdown from "./TramiteDropdown";

export const SubComercialTramitesColumns: ColumnDef<TramiteVM>[] = [
  {
    id: "id",
    accessorFn: (row) => row,
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
    id: "Fecha de Renovación",
    accessorKey: "renovation_date",
    header: ({ column }) => {
      return (
        <Button
          variant="faded"
          size="sm"
          className="font-bold flex justify-between w-full m-0 border-0 bg-transparent text-[var(--primary-color-950)]"
          onPress={() => column.toggleSorting(column.getIsSorted() === "asc")}
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
      if (!row.original.renovation_date) return "---";
      return (
        <span>
          {row.original.renovation_date
            ? formatDate(row.original.renovation_date)
            : "---"}
        </span>
      );
    },
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.renovation_date;
      const b = rowB.original.renovation_date;

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
        <Tooltip
          content={
            <div className="flex flex-col gap-1">
              <span>{row.original.client_name}</span>
              <span className="text-xs text-gray-500">
                {row.original.client_email}
              </span>
            </div>
          }
        >
          <div className="flex flex-col">
            <span className="block max-w-36 w-full text-ellipsis overflow-hidden whitespace-nowrap">
              {row.original.client_name}
            </span>
            <span className="text-xs text-gray-500 block max-w-32 text-ellipsis overflow-hidden whitespace-nowrap">
              {row.original.client_email}
            </span>
          </div>
        </Tooltip>
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
            <Tooltip
              key={index}
              content={
                <div className="flex items-center gap-2">
                  <span className="text-ellipsis overflow-hidden whitespace-nowrap">
                    {CUPS}
                  </span>
                  <Copy className="mr-2" size={16} color="white" />
                </div>
              }
              className="bg-[var(--primary-color-500)] rounded-full text-white cursor-pointer"
              radius="lg"
              onClick={() => copyLink(CUPS)}
            >
              <span className="block max-w-36 w-full overflow-hidden text-ellipsis whitespace-nowrap">
                {CUPS}
              </span>
            </Tooltip>
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
    id: "Contrato",
    accessorKey: "contract_type",
    header: "Contrato",
    cell: ({ row }) => {
      return (
        <div className="flex flex-col">
          {row.original.contract_type.map((type, index) => (
            <Tooltip
              key={index}
              content={type}
              radius="lg"
              color="primary"
              className="text-white"
            >
              <span className="text-ellipsis overflow-hidden whitespace-nowrap max-w-44 w-full">
                {type}
              </span>
            </Tooltip>
          ))}
        </div>
      );
    },
  },
  {
    id: "Estado",
    accessorKey: "status",
    header: "Estado",
    cell: ({ row }) => {
      return (
        <Chip
          size="sm"
          variant="flat"
          color={
            row.original.status === "Borrador"
              ? "danger"
              : row.original.status === "Tramitable"
              ? "default"
              : row.original.status === "Verificado"
              ? "secondary"
              : row.original.status === "Pendiente de Firma"
              ? "warning"
              : row.original.status === "Procesando"
              ? "primary"
              : row.original.status === "Activo"
              ? "success"
              : row.original.status === "Baja"
              ? "danger"
              : "default"
          }
        >
          {row.original.status === "Pendiente de Firma"
            ? "Pendiente"
            : row.original.status}
        </Chip>
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      return <TramiteDropdown tramite={row.original} />;
    },
  },
];

export const ComercialTramiteColumns: ColumnDef<TramiteVM>[] = [
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
    id: "Fecha de Renovación",
    accessorKey: "renovation_date",
    header: ({ column }) => {
      return (
        <Button
          variant="faded"
          size="sm"
          className="font-bold flex justify-between w-full m-0 border-0 bg-transparent text-[var(--primary-color-950)]"
          onPress={() => column.toggleSorting(column.getIsSorted() === "asc")}
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
      if (!row.original.renovation_date) return "---";
      return (
        <span>
          {row.original.renovation_date
            ? formatDate(row.original.renovation_date)
            : "---"}
        </span>
      );
    },
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.renovation_date;
      const b = rowB.original.renovation_date;

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
        <Tooltip
          content={
            <div className="flex flex-col gap-1">
              <span>{row.original.client_name}</span>
              <span className="text-xs text-gray-500">
                {row.original.client_email}
              </span>
            </div>
          }
        >
          <div className="flex flex-col">
            <span className="block max-w-36 w-full text-ellipsis overflow-hidden whitespace-nowrap">
              {row.original.client_name}
            </span>
            <span className="text-xs text-gray-500 block max-w-32 text-ellipsis overflow-hidden whitespace-nowrap">
              {row.original.client_email}
            </span>
          </div>
        </Tooltip>
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
            <Tooltip
              key={index}
              content={
                <div className="flex items-center gap-2">
                  <span className="text-ellipsis overflow-hidden whitespace-nowrap">
                    {CUPS}
                  </span>
                  <Copy className="mr-2" size={16} color="white" />
                </div>
              }
              className="bg-[var(--primary-color-500)] rounded-full text-white cursor-pointer"
              radius="lg"
              onClick={() => copyLink(CUPS)}
            >
              <span className="block max-w-36 w-full overflow-hidden text-ellipsis whitespace-nowrap">
                {CUPS}
              </span>
            </Tooltip>
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
    id: "Contrato",
    accessorKey: "contract_type",
    header: "Contrato",
    cell: ({ row }) => {
      return (
        <div className="flex flex-col">
          {row.original.contract_type.map((type, index) => (
            <Tooltip
              key={index}
              content={type}
              radius="lg"
              color="primary"
              className="text-white"
            >
              <span className="text-ellipsis overflow-hidden whitespace-nowrap max-w-44 w-full">
                {type}
              </span>
            </Tooltip>
          ))}
        </div>
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
      return (
        <Chip
          size="sm"
          variant="flat"
          color={
            row.original.status === "Borrador"
              ? "danger"
              : row.original.status === "Tramitable"
              ? "default"
              : row.original.status === "Verificado"
              ? "secondary"
              : row.original.status === "Pendiente de Firma"
              ? "warning"
              : row.original.status === "Procesando"
              ? "primary"
              : row.original.status === "Activo"
              ? "success"
              : row.original.status === "Baja"
              ? "danger"
              : "default"
          }
        >
          {row.original.status === "Pendiente de Firma"
            ? "Pendiente"
            : row.original.status}
        </Chip>
      );
    },
  },
  {
    id: "Liquidez",
    accessorKey: "liquidez_status",
    header: "Liquidez",
    cell: ({ row }) => {
      if (!row.original.liquidez_status) return "---";
      return (
        <Chip
          size="sm"
          variant="flat"
          color={
            row.original.liquidez_status === "Pagado al Comercial"
              ? "success"
              : "default"
          }
        >
          {row.original.liquidez_status === "Pagado al comercial"
            ? "Pagado"
            : "---"}
        </Chip>
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      return <TramiteDropdown tramite={row.original} />;
    },
  },
];

export const TramiteColumns: ColumnDef<TramiteVM>[] = [
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
    id: "Fecha de Renovación",
    accessorKey: "renovation_date",
    header: ({ column }) => {
      return (
        <Button
          variant="faded"
          size="sm"
          className="font-bold flex justify-between w-full m-0 border-0 bg-transparent text-[var(--primary-color-950)]"
          onPress={() => column.toggleSorting(column.getIsSorted() === "asc")}
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
      if (!row.original.renovation_date) return "---";
      return (
        <span>
          {row.original.renovation_date
            ? formatDate(row.original.renovation_date)
            : "---"}
        </span>
      );
    },
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.renovation_date;
      const b = rowB.original.renovation_date;

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
        <Tooltip
          content={
            <div className="flex flex-col gap-1">
              <span>{row.original.client_name}</span>
              <span className="text-xs text-gray-500">
                {row.original.client_email}
              </span>
            </div>
          }
        >
          <div className="flex flex-col">
            <span className="block max-w-36 w-full text-ellipsis overflow-hidden whitespace-nowrap">
              {row.original.client_name}
            </span>
            <span className="text-xs text-gray-500 block max-w-32 text-ellipsis overflow-hidden whitespace-nowrap">
              {row.original.client_email}
            </span>
          </div>
        </Tooltip>
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
            <Tooltip
              key={index}
              content={
                <div className="flex items-center gap-2">
                  <span className="text-ellipsis overflow-hidden whitespace-nowrap">
                    {CUPS}
                  </span>
                  <Copy className="mr-2" size={16} color="white" />
                </div>
              }
              className="bg-[var(--primary-color-500)] rounded-full text-white cursor-pointer"
              radius="lg"
              onClick={() => copyLink(CUPS)}
            >
              <span className="block max-w-36 w-full overflow-hidden text-ellipsis whitespace-nowrap">
                {CUPS}
              </span>
            </Tooltip>
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
    id: "Contrato",
    accessorKey: "contract_type",
    header: "Contrato",
    cell: ({ row }) => {
      return (
        <div className="flex flex-col">
          {row.original.contract_type.map((type, index) => (
            <Tooltip
              key={index}
              content={type}
              radius="lg"
              color="primary"
              className="text-white"
            >
              <span className="text-ellipsis overflow-hidden whitespace-nowrap max-w-44 w-full">
                {type}
              </span>
            </Tooltip>
          ))}
        </div>
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
            {row.original.comision ? `${row.original.comision}€` : "---"}
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
      return (
        <Chip
          size="sm"
          variant="flat"
          color={
            row.original.status === "Borrador"
              ? "danger"
              : row.original.status === "Tramitable"
              ? "default"
              : row.original.status === "Verificado"
              ? "secondary"
              : row.original.status === "Pendiente de Firma"
              ? "warning"
              : row.original.status === "Procesando"
              ? "primary"
              : row.original.status === "Activo"
              ? "success"
              : row.original.status === "Baja"
              ? "danger"
              : "default"
          }
        >
          {row.original.status === "Pendiente de Firma"
            ? "Pendiente"
            : row.original.status}
        </Chip>
      );
    },
  },
  {
    id: "Liquidez",
    accessorKey: "liquidez_status",
    header: "Liquidez",
    cell: ({ row }) => {
      if (!row.original.liquidez_status) return "---";
      return (
        <Chip
          size="sm"
          variant="flat"
          color={
            row.original.liquidez_status === "Pendiente de Cobro"
              ? "warning"
              : row.original.liquidez_status === "Cobrado por Comercializadora"
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
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      return <TramiteDropdown tramite={row.original} />;
    },
  },
];
