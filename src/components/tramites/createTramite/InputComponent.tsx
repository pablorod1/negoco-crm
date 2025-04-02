"use client";
import AvatarComponent from "@/components/core/AvatarComponent";
import { ClientDB, ComparativaPlan, User } from "@/lib/core/types";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";

interface SelectProps {
  name: string;
  label: string;
  items: (string | User | ComparativaPlan | ClientDB)[];
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  errors?: string;
  selectedKey: string;
  isRequired?: boolean;
  disabled?: boolean;
  multiple?: boolean;
}
export const SelectComponent: React.FC<SelectProps> = ({
  name,
  items,
  onChange,
  errors,
  selectedKey,
  label,
  isRequired,
  disabled,
  multiple,
}) => {
  return (
    <div className="flex flex-col gap-2 w-full">
      <Select
        name={name}
        size="lg"
        variant="bordered"
        isRequired={isRequired}
        errorMessage=""
        radius="sm"
        selectionMode={multiple ? "multiple" : "single"}
        label={label}
        onChange={onChange}
        isDisabled={disabled}
        selectedKeys={[selectedKey]}
        color={errors ? "danger" : "primary"}
      >
        {items.map((item) => {
          const isClient =
            typeof item !== "string" && "document_number" in item;
          const key =
            typeof item === "string"
              ? item
              : isClient
                ? item.document_number
                : item.id;
          const value = typeof item === "string" ? item : item.name;

          const avatar = typeof item !== "string";
          return (
            <SelectItem
              color="primary"
              variant="flat"
              startContent={
                avatar && !isClient ? (
                  <AvatarComponent userData={item as User} className="size-8" />
                ) : null
              }
              key={key}
              textValue={isClient ? `${item.name} ${item.last_name}` : value}
            >
              {isClient ? (
                <div>
                  <p className="text-sm font-semibold">
                    {item.name} {item.last_name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {item.document_number}
                  </p>
                </div>
              ) : (
                <p className="text-sm font-semibold">{value}</p>
              )}
            </SelectItem>
          );
        })}
      </Select>
      {errors && <p className="text-red-600 text-sm ms-1">{errors}</p>}
    </div>
  );
};

interface InputProps {
  name: string;
  label: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  errors?: string;
  type: string;
  isRequired?: boolean;
  startContent?: React.ReactNode;
  endContent?: React.ReactNode;
  value?: string;
  disabled?: boolean;
}

export const InputComponent: React.FC<InputProps> = ({
  name,
  label,
  onChange,
  errors,
  type,
  isRequired,
  startContent,
  endContent,
  value,
  disabled,
}) => {
  return (
    <div className="flex flex-col gap-2 w-full">
      <Input
        onChange={onChange}
        name={name}
        label={label}
        type={type}
        value={value}
        size="lg"
        radius="sm"
        variant="bordered"
        isRequired={isRequired}
        errorMessage=""
        startContent={startContent}
        endContent={endContent}
        isDisabled={disabled}
        color={errors ? "danger" : "primary"}
      />
      {errors && <p className="text-red-600 text-sm ms-1">{errors}</p>}
    </div>
  );
};
