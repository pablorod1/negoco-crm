"use client";
import AvatarComponent from "@/components/core/AvatarComponent";
import { ClientDB, ComparativaPlan, User } from "@/lib/core/types";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Comercial } from "@/components/colaboradores/CreateUserForm";

interface SelectProps {
  name: string;
  label: string;
  items: (string | User | ComparativaPlan | ClientDB | Comercial)[];
  onChange: (value: string, e?: React.ChangeEvent<HTMLSelectElement>) => void;

  errors?: string;
  selectedKey: string;
  isRequired?: boolean;
  disabled?: boolean;
  defaultSelectedKey?: string;
  textValue?: string;
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
  textValue,
}) => {
  return (
    <div className="flex flex-col gap-2 w-full">
      <Label htmlFor={name}>
        {label} {isRequired && <span className="text-red-500">*</span>}
      </Label>
      <Select
        name={name}
        required={isRequired}
        onValueChange={onChange}
        disabled={disabled}
        value={selectedKey}
      >
        <SelectTrigger>
          <SelectValue placeholder="Seleccione una opción">
            {textValue || selectedKey}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => {
            const isClient =
              typeof item !== "string" && "document_number" in item;
            const key = typeof item === "string" ? item : item.id;
            const value = typeof item === "string" ? item : item.name;
            const avatar = typeof item !== "string";
            return (
              <SelectItem
                value={key}
                key={key}
                textValue={isClient ? `${item.name} ${item.last_name}` : value}
                className="rounded-md group"
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
                ) : avatar && !isClient ? (
                  <div className="flex items-center gap-2">
                    <AvatarComponent
                      userData={item as User}
                      className="size-8 group-hover:text-black"
                    />
                    <p className="text-sm font-semibold">{value}</p>
                  </div>
                ) : (
                  <p className="text-sm font-semibold">{value}</p>
                )}
              </SelectItem>
            );
          })}
        </SelectContent>
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
  value: string | number;
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
      <Label htmlFor={name}>
        {label} {isRequired && <span className="text-red-500">*</span>}
      </Label>

      <div className="relative">
        {startContent && (
          <div className="absolute left-2.5 top-2.5 text-muted-foreground">
            {startContent}
          </div>
        )}
        <Input
          onChange={onChange}
          id={name}
          name={name}
          type={type}
          value={value || ""}
          disabled={disabled ? true : false}
          color={errors ? "danger" : "primary"}
          className={`z-10 ${startContent ? "pl-8" : ""} ${endContent ? "pr-8" : ""}`}
        />
        {endContent && (
          <div className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground">
            {endContent}
          </div>
        )}
      </div>

      {errors && <p className="text-red-600 text-sm ms-1">{errors}</p>}
    </div>
  );
};
