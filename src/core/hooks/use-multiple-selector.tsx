import { Option } from "../components/ui/multiselect";

export function useMultipleSelector() {
  // Convert options to the new format
  const convertToOptions = (
    items: { label: string; value: string; icon?: string }[]
  ): Option[] => {
    return items.map((item) => ({
      value: item.value,
      label: item.label,
    }));
  };

  const convertFromOptions = (options: Option[]): string[] => {
    return options.map((option) => option.value);
  };

  const getSelectedOptions = (
    values: string[] | undefined,
    allOptions: { label: string; value: string; icon?: string }[]
  ): Option[] => {
    if (!values) return [];
    return values.map((value) => {
      const option = allOptions.find((opt) => opt.value === value);
      return {
        value,
        label: option?.label || value,
      };
    });
  };

  return { convertToOptions, convertFromOptions, getSelectedOptions };
}
