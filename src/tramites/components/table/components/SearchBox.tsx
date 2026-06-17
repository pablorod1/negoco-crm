"use client";

import { Search, X } from "lucide-react";
import { InputComponent } from "@/tramites/components/createTramite/InputComponent";

interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchBox({
  value,
  onChange,
  placeholder = "Buscar por CUPS, cliente, compañía...",
}: SearchBoxProps) {
  const handleClearSearch = () => {
    onChange("");
  };

  return (
    <div className="relative w-80">
      <InputComponent
        name="search"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        startContent={<Search size={16} className="text-gray-400" />}
        endContent={
          value && (
            <button type="button"
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )
        }
      />
    </div>
  );
}
