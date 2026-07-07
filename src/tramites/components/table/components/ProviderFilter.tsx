"use client";

import { X } from "lucide-react";
import { Label } from "@/core/components/ui/label";
import { Input } from "@/core/components/ui/input";
import { Badge } from "@/core/components/ui/badge";
import { useProviderFilter } from "@/tramites/hooks/useProviderFilter";
import MultipleSelector from "@/core/components/ui/multiselect";
import { useMultipleSelector } from "@/core/hooks/use-multiple-selector";
import { useCrmSettings } from "@/crm-settings/hooks/useCrmSettings";

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
  const { settings } = useCrmSettings();
  const { convertToOptions, convertFromOptions, getSelectedOptions } =
    useMultipleSelector();

  const providerOptions =
    settings?.providers.map((provider) => ({
      label: provider.name,
      value: provider.name,
    })) ?? [];

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium text-gray-700">Proveedor</Label>
      <div className="space-y-3">
        {providerOptions.length > 0 ? (
          <MultipleSelector
            value={getSelectedOptions(providerFilter, providerOptions)}
            defaultOptions={convertToOptions(providerOptions)}
            onChange={(options) =>
              setProviderFilter(convertFromOptions(options))
            }
            placeholder="Seleccionar proveedores"
            emptyIndicator={
              <p className="text-center text-sm text-gray-500">
                Sin resultados
              </p>
            }
            className="border-gray-200"
          />
        ) : (
          <Input
            placeholder="Escribir nombre del proveedor y presionar Enter..."
            value={providerInputValue}
            onChange={(e) => setProviderInputValue(e.target.value)}
            onKeyDown={handleProviderKeyDown}
            className="h-10 border-gray-200 focus:border-primary-500 focus:ring-primary-500"
          />
        )}
        {providerFilter && providerFilter.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {providerFilter.map((provider) => (
              <Badge
                key={provider}
                variant="secondary"
                className="text-xs px-3 py-1.5 bg-primary-50 text-primary-700 border-primary-200 flex items-center gap-2"
              >
                {provider}
                <button type="button"
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
