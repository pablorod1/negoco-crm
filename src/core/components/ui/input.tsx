import * as React from "react";

import { cn } from "@/core/utils";

type InputProps = React.ComponentProps<"input"> & {
  /** Convierte lo que se escribe a mayúsculas, manteniendo la posición del cursor. */
  uppercase?: boolean;
};

const toUpper = (value: string) => value.toLocaleUpperCase("es-ES");

const keepSelection = (input: HTMLInputElement, update: () => void) => {
  const { selectionStart, selectionEnd } = input;
  update();
  if (selectionStart !== null && selectionEnd !== null) {
    input.setSelectionRange(selectionStart, selectionEnd);
  }
};

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, uppercase, onChange, onCompositionEnd, ...props }, ref) => {
    const handleChange = uppercase
      ? (e: React.ChangeEvent<HTMLInputElement>) => {
          const input = e.target;
          // Durante una composición (tildes con tecla muerta en macOS, IME)
          // tocar el valor rompe el carácter; se convierte en compositionend.
          const composing = (e.nativeEvent as InputEvent).isComposing;
          if (!composing && input.value !== toUpper(input.value)) {
            keepSelection(input, () => {
              input.value = toUpper(input.value);
            });
          }
          onChange?.(e);
        }
      : onChange;

    const handleCompositionEnd = uppercase
      ? (e: React.CompositionEvent<HTMLInputElement>) => {
          onCompositionEnd?.(e);
          const input = e.currentTarget;
          if (input.value === toUpper(input.value)) return;
          // El setter del prototipo salta el seguimiento de valor de React, así
          // el evento "input" re-disparado llega a onChange con el valor nuevo.
          const setValue = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            "value",
          )?.set;
          keepSelection(input, () => setValue?.call(input, toUpper(input.value)));
          input.dispatchEvent(new Event("input", { bubbles: true }));
        }
      : onCompositionEnd;

    return (
      <input
        type={type}
        onChange={handleChange}
        onCompositionEnd={handleCompositionEnd}
        className={cn(
          "flex h-9 w-full rounded-full border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
