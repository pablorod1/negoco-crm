import {
  ComparativaPlan,
  ComparativaRow,
  ComparativaVM,
  User,
} from "@/lib/core/types";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@heroui/button";
import { ArrowDown, ArrowUpDown, ArrowUpIcon } from "lucide-react";
import { formatDate } from "@/lib/core/format";
import AvatarComponent from "@/components/core/AvatarComponent";
import { Chip } from "@heroui/chip";
import React from "react";
import ComparativaDropdown from "./ComparativaDropdown";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

export const createSubcomercialComparativasColumns = (
  handlePlanChange: (rowId: string, plan: ComparativaPlan) => void,
  getSelectedPlan: (rowId: string) => ComparativaPlan | undefined
): ColumnDef<ComparativaRow>[] => [
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
          className="font-bold m-0 border-0 bg-transparent text-[var(--primary-color-950)]"
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
    id: "Cliente",
    accessorKey: "client",
    header: "Cliente",
  },
  {
    id: "Comercial",
    accessorKey: "user",
    header: "Comercial",
    cell: ({ row }) => {
      return (
        <div className="flex items-center gap-2">
          <AvatarComponent
            userData={row.original.user as User}
            className="size-8"
          />
          <div className="flex flex-col">
            <span>{(row.original.user as User).name}</span>
            <span className="text-sm text-gray-500">
              {(row.original.user as User).email}
            </span>
          </div>
        </div>
      );
    },
  },
  {
    id: "Servicio",
    accessorKey: "service",
    header: "Servicio",
  },
  {
    id: "Plan",
    accessorKey: "plan",
    header: "Plan",
    cell: ({ row }) => {
      const rowId = row.original.id;
      const plans = row.original.plan;
      const currentSelectedPlan = getSelectedPlan(rowId);

      return (
        <PlanCell
          rowId={rowId}
          plans={plans}
          onPlanChange={handlePlanChange}
          currentSelectedPlan={currentSelectedPlan}
        />
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
            row.original.status === "pending"
              ? "warning"
              : row.original.status === "completed"
              ? "success"
              : row.original.status === "processed"
              ? "primary"
              : row.original.status === "rejected"
              ? "danger"
              : "default"
          }
        >
          {row.original.status === "pending"
            ? "Pendiente de Estudio"
            : row.original.status === "completed"
            ? "Estudio Realizado"
            : row.original.status === "processed"
            ? "Comparativa Tramitada"
            : row.original.status === "rejected"
            ? "Comparativa Rechazada"
            : row.original.status}
        </Chip>
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      return (
        <ComparativaDropdown comparativa={row.original as ComparativaVM} />
      );
    },
  },
];

// Componente React para la celda de Plan
const PlanCell = ({
  rowId,
  plans,
  onPlanChange,
  currentSelectedPlan,
}: {
  rowId: string;
  plans: ComparativaPlan[];
  onPlanChange: (rowId: string, plan: ComparativaPlan) => void;
  currentSelectedPlan?: ComparativaPlan;
}) => {
  const selectedPlan = currentSelectedPlan || plans[0];

  const handleChange = (value: string) => {
    const plan = value as ComparativaPlan;
    onPlanChange(rowId, plan);
  };

  // Si solo hay un plan, mostrar como texto
  if (plans.length === 1) {
    return <span className="capitalize">{plans[0].toString()}</span>;
  }

  // Si hay múltiples planes, mostrar como desplegable
  return (
    <Select aria-label="Plan" value={selectedPlan} onValueChange={handleChange}>
      <SelectTrigger className="capitalize w-32">
        {selectedPlan.toUpperCase()}
      </SelectTrigger>
      <SelectContent>
        {plans.map((plan) => (
          <SelectItem key={plan} value={plan} className="capitalize">
            {plan.toUpperCase()}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

// Componente React para la celda de Comisión
const ComisionCell = ({
  comisiones,
  plans,
  selectedPlan,
}: {
  rowId: string;
  comisiones: { fijo: number; indexado: number };
  plans: Array<ComparativaPlan>;
  selectedPlan?: ComparativaPlan;
}) => {
  const activePlan = selectedPlan || plans[0];

  // Si solo hay un plan, mostrar solo ese valor
  if (plans.length === 1) {
    const planType = plans[0];
    return <span>{comisiones[planType]} €</span>;
  }

  // Si hay múltiples planes, mostrar el valor correspondiente al seleccionado
  return <span>{comisiones[activePlan]} €</span>;
};

// Creamos un hook personalizado para gestionar el estado de los planes seleccionados
export const useComparativasState = () => {
  const [selectedPlans, setSelectedPlans] = React.useState<
    Record<string, ComparativaPlan>
  >({});

  const handlePlanChange = React.useCallback(
    (rowId: string, plan: ComparativaPlan) => {
      setSelectedPlans((prev) => ({
        ...prev,
        [rowId]: plan,
      }));
    },
    []
  );

  const getSelectedPlan = React.useCallback(
    (rowId: string) => {
      return selectedPlans[rowId];
    },
    [selectedPlans]
  );

  return {
    selectedPlans,
    handlePlanChange,
    getSelectedPlan,
  };
};

// Función para crear las columnas con el estado necesario
export const createComercialComparativasColumns = (
  handlePlanChange: (rowId: string, plan: ComparativaPlan) => void,
  getSelectedPlan: (rowId: string) => ComparativaPlan | undefined
): ColumnDef<ComparativaRow>[] => [
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
          className="font-bold m-0 border-0 bg-transparent text-[var(--primary-color-950)]"
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
    id: "Cliente",
    accessorKey: "client",
    header: "Cliente",
  },
  {
    id: "Comercial",
    accessorKey: "user",
    header: "Comercial",
    cell: ({ row }) => {
      return (
        <div className="flex items-center gap-2">
          <AvatarComponent
            userData={row.original.user as User}
            className="size-8 !rounded-full"
          />
          <div className="flex flex-col">
            <span>{(row.original.user as User).name}</span>
            <span className="text-sm text-gray-500">
              {(row.original.user as User).email}
            </span>
          </div>
        </div>
      );
    },
  },
  {
    id: "Servicio",
    accessorKey: "service",
    header: "Servicio",
  },
  {
    id: "Plan",
    accessorKey: "plan",
    header: "Plan",
    cell: ({ row }) => {
      const rowId = row.original.id;
      const plans = row.original.plan;
      const currentSelectedPlan = getSelectedPlan(rowId);

      return (
        <PlanCell
          rowId={rowId}
          plans={plans}
          onPlanChange={handlePlanChange}
          currentSelectedPlan={currentSelectedPlan}
        />
      );
    },
  },
  {
    id: "Comisión",
    accessorKey: "comision_sales_person",
    header: "Comisión",
    cell: ({ row }) => {
      const rowId = row.original.id;
      const comisiones = row.original.comision_sales_person;
      const plans = row.original.plan;
      const selectedPlan = getSelectedPlan(rowId);

      return (
        <ComisionCell
          rowId={rowId}
          comisiones={comisiones}
          plans={plans}
          selectedPlan={selectedPlan}
        />
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
            row.original.status === "pending"
              ? "warning"
              : row.original.status === "completed"
              ? "success"
              : row.original.status === "processed"
              ? "primary"
              : row.original.status === "rejected"
              ? "danger"
              : "default"
          }
        >
          {row.original.status === "pending"
            ? "Pendiente de Estudio"
            : row.original.status === "completed"
            ? "Estudio Realizado"
            : row.original.status === "processed"
            ? "Comparativa Tramitada"
            : row.original.status === "rejected"
            ? "Comparativa Rechazada"
            : row.original.status}
        </Chip>
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      return (
        <ComparativaDropdown comparativa={row.original as ComparativaVM} />
      );
    },
  },
];

export const createComparativasColumns = (
  handlePlanChange: (rowId: string, plan: ComparativaPlan) => void,
  getSelectedPlan: (rowId: string) => ComparativaPlan | undefined
): ColumnDef<ComparativaRow>[] => [
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
          className="font-bold m-0 border-0 bg-transparent text-[var(--primary-color-950)]"
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
    id: "Cliente",
    accessorKey: "client",
    header: "Cliente",
  },
  {
    id: "Comercial",
    accessorKey: "user",
    header: "Comercial",
    cell: ({ row }) => {
      return (
        <div className="flex items-center gap-2">
          <AvatarComponent
            userData={row.original.user as User}
            className="size-8 !rounded-full"
          />
          <div className="flex flex-col">
            <span>{(row.original.user as User).name}</span>
            <span className="text-sm text-gray-500">
              {(row.original.user as User).email}
            </span>
          </div>
        </div>
      );
    },
  },
  {
    id: "Servicio",
    accessorKey: "service",
    header: "Servicio",
  },
  {
    id: "Plan",
    accessorKey: "plan",
    header: "Plan",
    cell: ({ row }) => {
      const rowId = row.original.id;
      const plans = row.original.plan;
      const currentSelectedPlan = getSelectedPlan(rowId);

      return (
        <PlanCell
          rowId={rowId}
          plans={plans}
          onPlanChange={handlePlanChange}
          currentSelectedPlan={currentSelectedPlan}
        />
      );
    },
  },
  {
    id: "Comisión Comercial",
    accessorKey: "comision_sales_person",
    header: "Comisión",
    cell: ({ row }) => {
      const rowId = row.original.id;
      const comisiones = row.original.comision_sales_person;
      const plans = row.original.plan;
      const selectedPlan = getSelectedPlan(rowId);

      return (
        <ComisionCell
          rowId={rowId}
          comisiones={comisiones}
          plans={plans}
          selectedPlan={selectedPlan}
        />
      );
    },
  },
  {
    id: "Comisión",
    accessorKey: "comision",
    header: "Comisión",
    cell: ({ row }) => {
      const rowId = row.original.id;
      const comisiones = row.original.comision;
      const plans = row.original.plan;
      const selectedPlan = getSelectedPlan(rowId);

      return (
        <ComisionCell
          rowId={rowId}
          comisiones={comisiones}
          plans={plans}
          selectedPlan={selectedPlan}
        />
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
            row.original.status === "pending"
              ? "warning"
              : row.original.status === "completed"
              ? "success"
              : row.original.status === "processed"
              ? "primary"
              : row.original.status === "rejected"
              ? "danger"
              : "default"
          }
        >
          {row.original.status === "pending"
            ? "Pendiente de Estudio"
            : row.original.status === "completed"
            ? "Estudio Realizado"
            : row.original.status === "processed"
            ? "Comparativa Tramitada"
            : row.original.status === "rejected"
            ? "Comparativa Rechazada"
            : row.original.status}
        </Chip>
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      return (
        <ComparativaDropdown comparativa={row.original as ComparativaVM} />
      );
    },
  },
];
