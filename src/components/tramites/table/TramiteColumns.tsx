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
import { Tooltip } from "@heroui/tooltip";
import { Chip } from "@heroui/chip";
import { TramiteVM, User } from "@/lib/core/types";
import EditTramiteDialog from "../EditTramiteDialog";
import RenewTramiteConfirmationDialog from "../RenewTramiteConfirmationDialog";
import { copyLink } from "@/lib/core/utils";
import DeleteTramiteConfirmationModal from "../DeleteTramiteConfirmationModal";
import { useUser } from "@/contexts/UserContext";

const getOneMonthBeforeRenovationDate = (renovation_date: string) => {
  // check if today is one month before the renovation date
  const today = new Date();
  const renovationDate = new Date(renovation_date);
  const oneMonthBefore = new Date(renovationDate);
  oneMonthBefore.setMonth(renovationDate.getMonth() - 1);

  return today.getTime() > oneMonthBefore.getTime();
};

const DeleteTramiteWithUserData = ({ tramite }: { tramite: TramiteVM }) => {
  const { userData } = useUser();

  return (
    <DeleteTramiteConfirmationModal
      tramite={tramite}
      userData={userData as User}
    />
  );
};

export const SubComercialTramitesColumns: ColumnDef<TramiteVM>[] = [
  {
    accessorKey: "id",
    header: "ID",
  },
  {
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
    accessorKey: "sales_name",
    header: "Comercial",
  },
  {
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
      return (
        <Popover placement="bottom" showArrow={true}>
          <PopoverTrigger>
            <Button>
              <EllipsisVertical size={20} />
            </Button>
          </PopoverTrigger>
          <PopoverContent>
            <div className="flex flex-col">
              <EditTramiteDialog tramite_id={row.original.id} />
              {getOneMonthBeforeRenovationDate(
                row.original.renovation_date
              ) && (
                <RenewTramiteConfirmationDialog tramite_id={row.original.id} />
              )}
            </div>
          </PopoverContent>
        </Popover>
      );
    },
  },
];

export const ComercialTramiteColumns: ColumnDef<TramiteVM>[] = [
  {
    accessorKey: "id",
    header: "ID",
  },
  {
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
    accessorKey: "sales_name",
    header: "Comercial",
  },
  {
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
      return (
        <Popover placement="bottom" showArrow={true}>
          <PopoverTrigger>
            <Button>
              <EllipsisVertical size={20} />
            </Button>
          </PopoverTrigger>
          <PopoverContent>
            <div className="flex flex-col">
              <EditTramiteDialog tramite_id={row.original.id} />
              {getOneMonthBeforeRenovationDate(
                row.original.renovation_date
              ) && (
                <RenewTramiteConfirmationDialog tramite_id={row.original.id} />
              )}
            </div>
          </PopoverContent>
        </Popover>
      );
    },
  },
];

export const TramiteColumns: ColumnDef<TramiteVM>[] = [
  {
    accessorKey: "id",
    header: "ID",
  },
  {
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
    accessorKey: "sales_name",
    header: "Comercial",
  },
  {
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
      return (
        <Popover placement="bottom">
          <PopoverTrigger>
            <Button color="default" variant="light" isIconOnly>
              <EllipsisVertical size={20} />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px]">
            <div className="flex flex-col items-start w-full">
              <DeleteTramiteWithUserData tramite={row.original} />
              <EditTramiteDialog tramite_id={row.original.id} />
              {getOneMonthBeforeRenovationDate(
                row.original.renovation_date
              ) && (
                <RenewTramiteConfirmationDialog tramite_id={row.original.id} />
              )}
            </div>
          </PopoverContent>
        </Popover>
      );
    },
  },
];
