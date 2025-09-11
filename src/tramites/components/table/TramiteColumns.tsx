"use client";

import { Button } from "@/core/components/ui/button";
import { formatDate, formatUUID } from "@/core/utils/format";
import type { ColumnDef } from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUpDown,
  ArrowUpIcon,
  Copy,
  AlertTriangle,
} from "lucide-react";
import { copyLink } from "@/core/utils";
import TramiteDropdown from "./TramiteDropdown";
import { getStatusBadge } from "@/core/hooks/use-status-badge";
import TooltipComponent from "@/core/components/TooltipComponent";
import { LiquidezStatus, Status, TramiteRow } from "@/tramites/types";
import { useEnergySupplierById } from "@/comercializadoras/hooks/useEnergySupplierById";

const isRenewable = (
  renovation_date: string
): {
  renewable: boolean;
  days?: number;
  option?: "30" | "15" | "7";
} => {
  const date = new Date(renovation_date);
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (30 >= days && days > 15) return { renewable: true, option: "30", days };
  if (15 >= days && days > 7) return { renewable: true, option: "15", days };
  if (days <= 7) return { renewable: true, option: "7", days };
  return { renewable: false };
};

// Shared header component for sortable columns
const SortableHeader = ({
  title,
  column,
}: {
  title: string;
  column: {
    toggleSorting: (desc?: boolean) => void;
    getIsSorted: () => false | "asc" | "desc";
  };
}) => (
  <Button
    variant="ghost"
    size="sm"
    className="h-8 px-2 font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 border-0 justify-between w-full"
    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
  >
    <span className="text-xs">{title}</span>
    {column.getIsSorted() === "asc" ? (
      <ArrowUpIcon className="ml-2 h-3 w-3" />
    ) : column.getIsSorted() === "desc" ? (
      <ArrowDown className="ml-2 h-3 w-3" />
    ) : (
      <ArrowUpDown className="ml-2 h-3 w-3 opacity-50" />
    )}
  </Button>
);

// Shared date sort function
const dateSortingFn = (
  rowA: { original: TramiteRow },
  rowB: { original: TramiteRow },
  accessor: keyof TramiteRow
) => {
  const a = rowA.original[accessor] as string | null;
  const b = rowB.original[accessor] as string | null;
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return new Date(a).getTime() - new Date(b).getTime();
};

// Client cell component
const ClientCell = ({ row }: { row: { original: TramiteRow } }) => (
  <TooltipComponent
    content={
      <div className="flex flex-col gap-1">
        <span className="text-white font-medium">
          {row.original.client_name}
        </span>
        <span className="text-gray-200 text-xs">
          {row.original.client_email}
        </span>
      </div>
    }
  >
    <div className="flex flex-col space-y-1">
      <span className="text-gray-900 text-sm font-medium block max-w-36 w-full text-ellipsis overflow-hidden whitespace-nowrap">
        {row.original.client_name}
      </span>
      <span className="text-gray-500 text-xs block max-w-32 text-ellipsis overflow-hidden whitespace-nowrap">
        {row.original.client_email}
      </span>
    </div>
  </TooltipComponent>
);

// CUPS cell component
const CupsCell = ({ row }: { row: { original: TramiteRow } }) => (
  <div className="flex flex-col space-y-1">
    {row.original.CUPS.map((CUPS: string, index: number) => (
      <TooltipComponent
        key={index}
        content={
          <div className="flex items-center gap-2">
            <span className="text-white font-mono">{CUPS}</span>
            <Copy className="w-4 h-4 text-gray-200" />
          </div>
        }
      >
        <div
          onClick={() => copyLink(CUPS)}
          className="flex items-center gap-2 group cursor-pointer p-1 rounded hover:bg-gray-50 transition-colors"
        >
          <span className="text-gray-700 text-sm font-mono block max-w-36 w-full overflow-hidden text-ellipsis whitespace-nowrap">
            {CUPS}
          </span>
          <Copy className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
        </div>
      </TooltipComponent>
    ))}
  </div>
);

// Company cell component
const CompanyCell = ({ row }: { row: { original: TramiteRow } }) => {
  const { supplier } = useEnergySupplierById(row.original.new_company[0]);
  const company = supplier ? supplier.name : row.original.new_company[0];
  return (
    <div className="flex flex-col space-y-1">
      {row.original.new_company.map((_, index: number) => (
        <span
          key={index}
          className="text-gray-700 text-sm text-ellipsis overflow-hidden whitespace-nowrap max-w-44 w-full"
        >
          {company}
        </span>
      ))}
    </div>
  );
};

// Contract type cell component
const ContractCell = ({ row }: { row: { original: TramiteRow } }) => (
  <div className="flex flex-col space-y-1">
    {row.original.contract_type.map((type: string, index: number) => (
      <span
        key={index}
        className="text-gray-700 text-sm text-ellipsis overflow-hidden whitespace-nowrap max-w-32"
      >
        {type}
      </span>
    ))}
  </div>
);

// Date cell component
const DateCell = ({
  date,
  showRenewal = false,
}: {
  date: string | null;
  showRenewal?: boolean;
}) => {
  if (!date) return <span className="text-gray-400 text-sm">---</span>;

  const renewableStatus = showRenewal ? isRenewable(date) : null;

  return (
    <div className="flex items-center gap-2">
      <span className="text-gray-700 text-sm">{formatDate(date)}</span>
      {showRenewal && renewableStatus?.renewable && (
        <TooltipComponent
          content={`Renovación en ${renewableStatus.days} días`}
        >
          <div className="flex items-center">
            <AlertTriangle
              className={`w-3 h-3 ${
                renewableStatus.option === "7"
                  ? "text-red-500"
                  : renewableStatus.option === "15"
                    ? "text-orange-500"
                    : "text-yellow-500"
              }`}
            />
          </div>
        </TooltipComponent>
      )}
    </div>
  );
};

// Commission cell component
const CommissionCell = ({
  amount,
  align = "left",
}: {
  amount: number | null;
  align?: "left" | "right";
}) => (
  <div className={`flex ${align === "right" ? "justify-end" : ""}`}>
    <span className="text-gray-900 text-sm font-semibold">
      {amount ? `${amount}€` : <span className="text-gray-400">---</span>}
    </span>
  </div>
);

export const SubComercialTramitesColumns: ColumnDef<TramiteRow, unknown>[] = [
  {
    id: "id",
    accessorKey: "id",
    header: () => <span className="text-gray-600 font-medium text-xs">ID</span>,
    cell: ({ row }) => (
      <span className="text-gray-500 text-sm font-mono">
        {formatUUID(row.original.id)}
      </span>
    ),
  },
  {
    id: "Fecha de Creación",
    accessorKey: "creation_date",
    header: ({ column }) => <SortableHeader title="Creación" column={column} />,
    cell: ({ row }) => <DateCell date={row.original.creation_date} />,
    sortingFn: (rowA, rowB) => dateSortingFn(rowA, rowB, "creation_date"),
  },
  {
    id: "Fecha de Activación",
    accessorKey: "activation_date",
    header: ({ column }) => (
      <SortableHeader title="Activación" column={column} />
    ),
    cell: ({ row }) => <DateCell date={row.original.activation_date} />,
    sortingFn: (rowA, rowB) => dateSortingFn(rowA, rowB, "activation_date"),
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
    cell: ClientCell,
  },
  {
    id: "CUPS",
    accessorKey: "CUPS",
    header: () => (
      <span className="text-gray-600 font-medium text-xs">CUPS</span>
    ),
    cell: CupsCell,
  },
  {
    id: "Compañía",
    accessorKey: "new_company",
    header: () => (
      <span className="text-gray-600 font-medium text-xs">Compañía</span>
    ),
    cell: CompanyCell,
  },
  {
    id: "Contrato",
    accessorKey: "contract_type",
    header: () => (
      <span className="text-gray-600 font-medium text-xs">Contrato</span>
    ),
    cell: ContractCell,
  },
  {
    id: "Estado",
    accessorKey: "status",
    header: () => (
      <span className="text-gray-600 font-medium text-xs">Estado</span>
    ),
    cell: ({ row }) => getStatusBadge(row.original.status as Status, "general"),
  },
  {
    id: "actions",
    cell: ({ row }) => <TramiteDropdown tramite={row.original} />,
  },
];

export const ComercialTramiteColumns: ColumnDef<TramiteRow, unknown>[] = [
  {
    id: "id",
    accessorKey: "id",
    header: () => <span className="text-gray-600 font-medium text-xs">ID</span>,
    cell: ({ row }) => (
      <span className="text-gray-500 text-sm font-mono">
        {formatUUID(row.original.id)}
      </span>
    ),
  },
  {
    id: "Fecha de Creación",
    accessorKey: "creation_date",
    header: ({ column }) => <SortableHeader title="Creación" column={column} />,
    cell: ({ row }) => <DateCell date={row.original.creation_date} />,
    sortingFn: (rowA, rowB) => dateSortingFn(rowA, rowB, "creation_date"),
  },
  {
    id: "Fecha de Activación",
    accessorKey: "activation_date",
    header: ({ column }) => (
      <SortableHeader title="Activación" column={column} />
    ),
    cell: ({ row }) => <DateCell date={row.original.activation_date} />,
    sortingFn: (rowA, rowB) => dateSortingFn(rowA, rowB, "activation_date"),
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
    cell: ClientCell,
  },
  {
    id: "CUPS",
    accessorKey: "CUPS",
    header: () => (
      <span className="text-gray-600 font-medium text-xs">CUPS</span>
    ),
    cell: CupsCell,
  },
  {
    id: "Compañía",
    accessorKey: "new_company",
    header: () => (
      <span className="text-gray-600 font-medium text-xs">Compañía</span>
    ),
    cell: CompanyCell,
  },
  {
    id: "Contrato",
    accessorKey: "contract_type",
    header: () => (
      <span className="text-gray-600 font-medium text-xs">Contrato</span>
    ),
    cell: ContractCell,
  },
  {
    id: "Comisión",
    accessorKey: "comision_sales_person",
    header: () => (
      <span className="text-gray-600 font-medium text-xs flex justify-end">
        Comisión
      </span>
    ),
    cell: ({ row }) => (
      <CommissionCell
        amount={row.original.comision_sales_person}
        align="right"
      />
    ),
  },
  {
    id: "Estado",
    accessorKey: "status",
    header: () => (
      <span className="text-gray-600 font-medium text-xs">Estado</span>
    ),
    cell: ({ row }) => getStatusBadge(row.original.status as Status, "general"),
  },
  {
    id: "Liquidez",
    accessorKey: "liquidez_status",
    header: () => (
      <span className="text-gray-600 font-medium text-xs">Liquidez</span>
    ),
    cell: ({ row }) => {
      if (!row.original.liquidez_status)
        return <span className="text-gray-400 text-sm">---</span>;
      if (row.original.liquidez_status === "Cobrado por Comercializadora")
        return <span className="text-gray-400 text-sm">---</span>;
      return getStatusBadge(
        row.original.liquidez_status as LiquidezStatus,
        "liquidez",
        true
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => <TramiteDropdown tramite={row.original} />,
  },
];

export const TramiteColumns: ColumnDef<TramiteRow, unknown>[] = [
  {
    id: "id",
    accessorKey: "id",
    header: () => <span className="text-gray-600 font-medium text-xs">ID</span>,
    cell: ({ row }) => (
      <span className="text-gray-500 text-sm font-mono">
        {formatUUID(row.original.id)}
      </span>
    ),
  },
  {
    id: "Fecha de Creación",
    accessorKey: "creation_date",
    header: ({ column }) => <SortableHeader title="Creación" column={column} />,
    cell: ({ row }) => <DateCell date={row.original.creation_date} />,
    sortingFn: (rowA, rowB) => dateSortingFn(rowA, rowB, "creation_date"),
  },
  {
    id: "Fecha de Activación",
    accessorKey: "activation_date",
    header: ({ column }) => (
      <SortableHeader title="Activación" column={column} />
    ),
    cell: ({ row }) => <DateCell date={row.original.activation_date} />,
    sortingFn: (rowA, rowB) => dateSortingFn(rowA, rowB, "activation_date"),
  },
  {
    id: "Fecha de Renovación",
    accessorKey: "renovation_date",
    header: ({ column }) => (
      <SortableHeader title="Renovación" column={column} />
    ),
    cell: ({ row }) => (
      <DateCell date={row.original.renovation_date} showRenewal={true} />
    ),
    sortingFn: (rowA, rowB) => dateSortingFn(rowA, rowB, "renovation_date"),
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
    cell: ClientCell,
  },
  {
    id: "CUPS",
    accessorKey: "CUPS",
    header: () => (
      <span className="text-gray-600 font-medium text-xs">CUPS</span>
    ),
    cell: CupsCell,
  },
  {
    id: "Compañía",
    accessorKey: "new_company",
    header: () => (
      <span className="text-gray-600 font-medium text-xs">Compañía</span>
    ),
    cell: CompanyCell,
  },
  {
    id: "Contrato",
    accessorKey: "contract_type",
    header: () => (
      <span className="text-gray-600 font-medium text-xs">Contrato</span>
    ),
    cell: ContractCell,
  },
  {
    id: "Comisión",
    accessorKey: "comision",
    header: () => (
      <span className="text-gray-600 font-medium text-xs flex justify-end">
        Comisión
      </span>
    ),
    cell: ({ row }) => (
      <CommissionCell amount={row.original.comision} align="right" />
    ),
  },
  {
    id: "Comisión Comercial",
    accessorKey: "comision_sales_person",
    header: () => (
      <span className="text-gray-600 font-medium text-xs flex justify-end">
        Comisión Comercial
      </span>
    ),
    cell: ({ row }) => (
      <CommissionCell
        amount={row.original.comision_sales_person}
        align="right"
      />
    ),
  },
  {
    id: "Estado",
    accessorKey: "status",
    header: () => (
      <span className="text-gray-600 font-medium text-xs">Estado</span>
    ),
    cell: ({ row }) => getStatusBadge(row.original.status as Status, "general"),
  },
  {
    id: "Liquidez",
    accessorKey: "liquidez_status",
    header: () => (
      <span className="text-gray-600 font-medium text-xs">Liquidez</span>
    ),
    cell: ({ row }) => {
      if (!row.original.liquidez_status)
        return <span className="text-gray-400 text-sm">---</span>;
      return getStatusBadge(
        row.original.liquidez_status as LiquidezStatus,
        "liquidez",
        true
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => <TramiteDropdown tramite={row.original} />,
  },
];
