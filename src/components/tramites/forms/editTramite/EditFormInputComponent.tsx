"use client";
import { Button, Input, Select, SelectItem } from "@heroui/react";
import { Pencil } from "lucide-react";
import React, { useState } from "react";

interface InputProps {
  name: string;
  label: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  errors?: string;
  type: string;
  isRequired?: boolean;
  startContent?: React.ReactNode;
  value?: string;
}

export const EditInputComponent: React.FC<InputProps> = ({
  name,
  label,
  onChange,
  errors,
  type,
  isRequired,
  startContent,
  value,
}: InputProps) => {
  const [editMode, setEditMode] = useState(false);
  return (
    <>
      {!editMode ? (
        <div className="flex items-center gap-2">
          <p className="text-base text-[var(--primary-color-800)] font-bold">
            {label}:
          </p>
          <span className="text-gray-800">{value}</span>
          <Button
            size="sm"
            variant="faded"
            className="border-0 bg-white -ms-1"
            isIconOnly
            onPress={() => setEditMode(!editMode)}
          >
            <Pencil size={16} stroke="#ccc" />
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 w-full">
          <Input
            onChange={onChange}
            name={name}
            label={label}
            type={type}
            defaultValue={value}
            size="lg"
            variant="bordered"
            radius="sm"
            className="max-w-80 w-full"
            isRequired={isRequired}
            errorMessage=""
            startContent={startContent}
            endContent={
              <Button
                color="primary"
                variant="ghost"
                radius="sm"
                onPress={() => setEditMode(!editMode)}
              >
                Guardar
              </Button>
            }
            color={errors ? "danger" : "primary"}
          />
          {errors && <p className="text-red-600 text-sm ms-1">{errors}</p>}
        </div>
      )}
    </>
  );
};

interface SelectProps {
  name: string;
  items: string[];
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  errors?: string;
  selectedKey: string;
  label: string;
  isRequired?: boolean;
}

export const EditSelectComponent: React.FC<SelectProps> = ({
  name,
  items,
  onChange,
  errors,
  selectedKey,
  label,
  isRequired,
}: SelectProps) => {
  const [editMode, setEditMode] = useState(false);
  return (
    <>
      {!editMode ? (
        <div className="flex items-center gap-2">
          <p className="text-base text-[var(--primary-color-800)] font-bold">
            {label}:
          </p>
          <span className="text-gray-800">{selectedKey}</span>
          <Button
            size="sm"
            variant="faded"
            className="border-0 bg-white -ms-1"
            isIconOnly
            onPress={() => setEditMode(!editMode)}
          >
            <Pencil size={16} stroke="#ccc" />
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 w-full">
          <div className="flex items-center gap-2">
            <Select
              name={name}
              size="lg"
              className="max-w-64 w-full"
              isRequired={isRequired}
              errorMessage=""
              radius="sm"
              variant="bordered"
              label={label}
              onChange={onChange}
              selectedKeys={[selectedKey]}
              color={errors ? "danger" : "primary"}
            >
              {items.map((item) => (
                <SelectItem key={item} value={item} textValue={item}>
                  {item}
                </SelectItem>
              ))}
            </Select>
            <Button
              color="primary"
              variant="ghost"
              radius="sm"
              onPress={() => setEditMode(!editMode)}
            >
              Guardar
            </Button>
          </div>
          {errors && <p className="text-red-600 text-sm ms-1">{errors}</p>}
        </div>
      )}
    </>
  );
};
