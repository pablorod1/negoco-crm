"use client";

import { X } from "lucide-react";
import { Label } from "@/core/components/ui/label";
import { Input } from "@/core/components/ui/input";
import { Badge } from "@/core/components/ui/badge";
import { useProviderFilter } from "@/tramites/hooks/useProviderFilter";

interface ProviderFilterProps {
  providerFilter: string[] | undefined;
  setProviderFilter: (value: string[]) => void;
}

export function ProviderFilter({
  providerFilter,
  setProviderFilter,
}: ProviderFilterProps) {
  const {
    providerInputValue,
    setProviderInputValue,
    handleProviderKeyDown,
    removeProvider,
  } = useProviderFilter({ providerFilter, setProviderFilter });

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium text-gray-700">Proveedor</Label>
      <div className="space-y-3">
        <Input
          placeholder="Escribir nombre del proveedor y presionar Enter..."
          value={providerInputValue}
          onChange={(e) => setProviderInputValue(e.target.value)}
          onKeyDown={handleProviderKeyDown}
          className="h-10 border-gray-200 focus:border-primary-500 focus:ring-primary-500"
        />
        {providerFilter && providerFilter.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {providerFilter.map((provider) => (
              <Badge
                key={provider}
                variant="secondary"
                className="text-xs px-3 py-1.5 bg-primary-50 text-primary-700 border-primary-200 flex items-center gap-2"
              >
                {provider}
                <button
                  onClick={() => removeProvider(provider)}
                  className="hover:text-red-600 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
