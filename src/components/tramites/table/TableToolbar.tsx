"use client";
import { FilterX, ChevronDownIcon, Settings2 } from "lucide-react";
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from "@heroui/dropdown";
import { Button } from "@heroui/button";
import {
  COMPANIES,
  COMPARATIVA_STATUS_TYPES,
  CONTRACT_TYPES,
  LIQUIDEZ_STATUS,
  STATUS_TYPES,
} from "@/lib/core/const";
import { ComparativaStatus, type Status } from "@/lib/core/types";
import { Table } from "@tanstack/react-table";
import { useState } from "react";

interface ColumnSelectorProps<TData> {
  table: Table<TData>;
}

export function ColumnSelector<TData>({ table }: ColumnSelectorProps<TData>) {
  const [selectedColumns, setSelectedColumns] = useState<string[]>(() =>
    table
      .getAllColumns()
      .filter((column) => column.getIsVisible())
      .map((column) => column.id)
  );
  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <Button size="sm">
          <Settings2 size={20} />
          Filtrar columnas
        </Button>
      </DropdownTrigger>
      <DropdownMenu
        selectedKeys={selectedColumns}
        defaultSelectedKeys={selectedColumns}
        onSelectionChange={(selected) => {
          setSelectedColumns(Array.from(selected) as string[]);
        }}
        selectionMode="multiple"
        className="w-[250px]"
      >
        {table
          .getAllColumns()
          .filter(
            (column) =>
              typeof column.accessorFn !== "undefined" && column.getCanHide()
          )
          .map((column) => {
            return (
              <DropdownItem
                key={column.id}
                onPress={() => column.toggleVisibility(!column.getIsVisible())}
                className="capitalize"
              >
                {column.id}
              </DropdownItem>
            );
          })}
      </DropdownMenu>
    </Dropdown>
  );
}

export function FilterButton({
  onPress,
  disabled,
}: {
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Button
      radius="sm"
      variant="ghost"
      color="danger"
      onPress={onPress}
      isDisabled={disabled}
      startContent={<FilterX size={20} />}
    >
      Quitar filtros
    </Button>
  );
}

export function CompanyDropdown({
  selected,
  onSelectionChange,
}: {
  selected: string[];
  onSelectionChange: (value: string[]) => void;
}) {
  return (
    <Dropdown radius="sm">
      <DropdownTrigger aria-label="Compañía">
        <Button
          endContent={
            <ChevronDownIcon width={12} height={12} className="text-gray-500" />
          }
          radius="sm"
          variant="bordered"
        >
          <span className="block max-w-44 w-full text-ellipsis overflow-hidden whitespace-nowrap">
            {selected.length > 0 ? selected.join(", ") : "Compañía"}
          </span>
        </Button>
      </DropdownTrigger>
      <DropdownMenu
        disallowEmptySelection={false}
        aria-label="Compañía"
        closeOnSelect={false}
        selectedKeys={selected}
        selectionMode="multiple"
        onSelectionChange={(selected) =>
          onSelectionChange(Array.from(selected) as string[])
        }
      >
        {COMPANIES.map((company) => (
          <DropdownItem key={company} className="capitalize">
            {company}
          </DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  );
}

// Similar pattern for StatusDropdown and ContractTypeDropdown

export function StatusDropdown({
  selected,
  onSelectionChange,
}: {
  selected: string[];
  onSelectionChange: (value: (Status | ComparativaStatus)[]) => void;
}) {
  return (
    <Dropdown radius="sm">
      <DropdownTrigger aria-label="Estado">
        <Button
          endContent={
            <ChevronDownIcon width={12} height={12} className="text-gray-500" />
          }
          variant="bordered"
          radius="sm"
        >
          <span className="block max-w-44 w-full text-ellipsis overflow-hidden whitespace-nowrap">
            {selected.length > 0 ? selected.join(", ") : "Estado"}
          </span>
        </Button>
      </DropdownTrigger>
      <DropdownMenu
        disallowEmptySelection={false}
        aria-label="Estado"
        closeOnSelect={false}
        selectedKeys={selected}
        selectionMode="multiple"
        onSelectionChange={(selected) =>
          onSelectionChange(Array.from(selected) as Status[])
        }
      >
        {STATUS_TYPES.map((status) => (
          <DropdownItem key={status} className="capitalize">
            {status}
          </DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  );
}

export function ComparativaStatusDropdown({
  selected,
  onSelectionChange,
}: {
  selected: string[];
  onSelectionChange: (value: ComparativaStatus[]) => void;
}) {
  return (
    <Dropdown radius="sm">
      <DropdownTrigger aria-label="Estado">
        <Button
          endContent={
            <ChevronDownIcon width={12} height={12} className="text-gray-500" />
          }
          variant="bordered"
          radius="sm"
        >
          <span className="block max-w-44 w-full text-ellipsis overflow-hidden whitespace-nowrap">
            {selected.length > 0 ? selected.join(", ") : "Estado"}
          </span>
        </Button>
      </DropdownTrigger>
      <DropdownMenu
        disallowEmptySelection={false}
        aria-label="Estado"
        closeOnSelect={false}
        selectedKeys={selected}
        selectionMode="multiple"
        onSelectionChange={(selected) =>
          onSelectionChange(Array.from(selected) as ComparativaStatus[])
        }
      >
        {COMPARATIVA_STATUS_TYPES.map((status) => (
          <DropdownItem key={status.key} className="capitalize">
            {status.label}
          </DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  );
}

export function LiquidezStatusDropdown({
  selected,
  onSelectionChange,
}: {
  selected: string[];
  onSelectionChange: (value: Status[]) => void;
}) {
  return (
    <Dropdown radius="sm">
      <DropdownTrigger aria-label="Estado">
        <Button
          endContent={
            <ChevronDownIcon width={12} height={12} className="text-gray-500" />
          }
          variant="bordered"
          radius="sm"
        >
          <span className="block max-w-44 w-full text-ellipsis overflow-hidden whitespace-nowrap">
            {selected.length > 0 ? selected.join(", ") : "Estado"}
          </span>
        </Button>
      </DropdownTrigger>
      <DropdownMenu
        disallowEmptySelection={false}
        aria-label="Estado"
        closeOnSelect={false}
        selectedKeys={selected}
        selectionMode="multiple"
        onSelectionChange={(selected) =>
          onSelectionChange(Array.from(selected) as Status[])
        }
      >
        {LIQUIDEZ_STATUS.map((status) => (
          <DropdownItem key={status} className="capitalize">
            {status}
          </DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  );
}

export function ContractTypeDropdown({
  selected,
  onSelectionChange,
}: {
  selected: string[];
  onSelectionChange: (value: string[]) => void;
}) {
  return (
    <Dropdown radius="sm">
      <DropdownTrigger aria-label="Tipo de contrato">
        <Button
          radius="sm"
          endContent={
            <ChevronDownIcon width={12} height={12} className="text-gray-500" />
          }
          variant="bordered"
        >
          <span className="block max-w-44 w-full text-ellipsis overflow-hidden whitespace-nowrap">
            {selected.length > 0 ? selected.join(", ") : "Tipo de contrato"}
          </span>
        </Button>
      </DropdownTrigger>
      <DropdownMenu
        disallowEmptySelection={false}
        aria-label="Tipo de contrato"
        closeOnSelect={false}
        selectedKeys={selected}
        selectionMode="multiple"
        onSelectionChange={(selected) =>
          onSelectionChange(Array.from(selected) as string[])
        }
      >
        {CONTRACT_TYPES.map((contractType) => (
          <DropdownItem key={contractType} className="capitalize">
            {contractType}
          </DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  );
}
