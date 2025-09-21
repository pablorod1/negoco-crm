import { useState } from "react";
import {
  normalizeProviderName,
  cleanProviderName,
} from "@/tramites/utils/formatters";

interface UseProviderFilterParams {
  providerFilter: string[] | undefined;
  setProviderFilter: (value: string[]) => void;
}

export function useProviderFilter({
  providerFilter,
  setProviderFilter,
}: UseProviderFilterParams) {
  const [providerInputValue, setProviderInputValue] = useState("");

  const handleProviderKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && providerInputValue.trim()) {
      e.preventDefault();
      const trimmedValue = providerInputValue.trim();
      const normalizedValue = normalizeProviderName(trimmedValue);

      const currentProviders = providerFilter || [];

      // Check if provider already exists (case-insensitive)
      const alreadyExists = currentProviders.some(
        (provider) => normalizeProviderName(provider) === normalizedValue
      );

      if (!alreadyExists) {
        // Store the original cased version but trimmed and with normalized spaces
        const cleanedValue = cleanProviderName(trimmedValue);
        setProviderFilter([...currentProviders, cleanedValue]);
      }
      setProviderInputValue("");
    }
  };

  const removeProvider = (providerToRemove: string) => {
    const currentProviders = providerFilter || [];
    setProviderFilter(
      currentProviders.filter((provider) => provider !== providerToRemove)
    );
  };

  return {
    providerInputValue,
    setProviderInputValue,
    handleProviderKeyDown,
    removeProvider,
  };
}
