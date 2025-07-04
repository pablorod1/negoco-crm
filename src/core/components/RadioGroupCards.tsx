import React from "react";
import * as RadioGroup from "@radix-ui/react-radio-group";
import { CircleCheck } from "lucide-react";
import { cn } from "@/core/utils";

interface Options {
  value: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

const RadioCards = ({
  options,
  defaultOption,
  className,
  onSelect,
}: {
  options: Options[];
  defaultOption?: string;
  className?: string;
  onSelect?: (value: string) => void;
}) => {
  return (
    <RadioGroup.Root
      defaultValue={defaultOption || options[0].value}
      onValueChange={onSelect}
      className={cn("max-w-md w-full grid grid-cols-3 gap-4", className)}
    >
      {options.map((option) => (
        <RadioGroup.Item
          key={option.value}
          value={option.value}
          className={cn(
            "relative group ring-[1px] ring-border rounded py-2 px-3 text-start",
            "data-[state=checked]:ring-2 data-[state=checked]:ring-primary-500",
            "flex items-center gap-4"
          )}
        >
          <CircleCheck className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 h-6 w-6 text-primary fill-primary-500 stroke-white group-data-[state=unchecked]:hidden" />

          {option.icon ? <>{option.icon}</> : null}
          <div>
            <span className="block font-semibold tracking-tight">
              {option.label}
            </span>
            {option.description ? (
              <p className="text-xs">{option.description}</p>
            ) : null}
          </div>
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
};

export default RadioCards;

