import { format } from "date-fns";
import { DateRange } from "react-day-picker";

/**
 * Utility functions for formatting dates and filter labels
 */

export const formatDateRange = (dateRange: DateRange): string => {
  if (!dateRange.from && !dateRange.to) return "";

  const fromDate = dateRange.from ? format(dateRange.from, "dd/MM/yyyy") : "";
  const toDate = dateRange.to ? format(dateRange.to, "dd/MM/yyyy") : "";

  return `${fromDate} - ${toDate}`;
};

export const getFilterLabel = (
  filterType: string,
  values: string[] | DateRange,
  options?: { label: string; value: string; icon?: string }[]
): string | null => {
  if (!values) return null;

  switch (filterType) {
    case "date":
      const dateRange = values as DateRange;
      if (!dateRange.from && !dateRange.to) return null;
      return formatDateRange(dateRange);

    case "select":
      if (!Array.isArray(values) || values.length === 0) return null;
      return (
        options
          ?.filter((opt) => values.includes(opt.value))
          .map((opt) => opt.label)
          .join(", ") || null
      );

    default:
      return null;
  }
};

export const normalizeProviderName = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/\s+/g, " ") // Replace multiple spaces with single space
    .trim();
};

export const cleanProviderName = (name: string): string => {
  return name.replace(/\s+/g, " ").trim();
};
