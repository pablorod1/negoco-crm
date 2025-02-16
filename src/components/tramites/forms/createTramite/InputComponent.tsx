"use client";
import { Input } from "@heroui/react";
import { Select, SelectItem } from "@heroui/select";

interface SelectProps {
  name: string;
  label: string;
  items: string[];
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  errors?: string;
  selectedKey: string;
  isRequired?: boolean;
}
export const SelectComponent: React.FC<SelectProps> = ({
  name,
  items,
  onChange,
  errors,
  selectedKey,
  label,
  isRequired,
}) => {
  return (
    <div className="flex flex-col gap-2 w-full">
      <Select
        name={name}
        size="lg"
        isRequired={isRequired}
        errorMessage=""
        radius="sm"
        label={label}
        onChange={onChange}
        selectedKeys={[selectedKey]}
        color={errors ? "danger" : "default"}
      >
        {items.map((item) => (
          <SelectItem key={item} value={item} textValue={item}>
            {item}
          </SelectItem>
        ))}
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
        isRequired={isRequired}
        errorMessage=""
        startContent={startContent}
        endContent={endContent}
        color={errors ? "danger" : "default"}
      />
      {errors && <p className="text-red-600 text-sm ms-1">{errors}</p>}
    </div>
  );
};
