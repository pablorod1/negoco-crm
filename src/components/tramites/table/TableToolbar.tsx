import { FilterX, ChevronDownIcon } from "lucide-react";
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Button,
} from "@heroui/react";
import { COMPANIES, CONTRACT_TYPES, STATUS_TYPES } from "@/lib/const";
import { type Status } from "@/lib/types";

export function FilterButton({ onPress }: { onPress: () => void }) {
  return (
    <Button isIconOnly variant="ghost" color="danger" onPress={onPress}>
      <FilterX className="h-4 w-4" />
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
    <Dropdown>
      <DropdownTrigger aria-label="Compañía">
        <Button
          endContent={
            <ChevronDownIcon width={12} height={12} className="text-gray-500" />
          }
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
  onSelectionChange: (value: Status[]) => void;
}) {
  return (
    <Dropdown>
      <DropdownTrigger aria-label="Estado">
        <Button
          endContent={
            <ChevronDownIcon width={12} height={12} className="text-gray-500" />
          }
          variant="bordered"
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

export function ContractTypeDropdown({
  selected,
  onSelectionChange,
}: {
  selected: string[];
  onSelectionChange: (value: string[]) => void;
}) {
  return (
    <Dropdown>
      <DropdownTrigger aria-label="Tipo de contrato">
        <Button
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
