import { useState, useEffect, useCallback } from "react";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;
const ALLOWED_PAGE_SIZES = [5, 10, 15, 20, 30, 40, 50, 100];

export const normalizeTablePageSize = (value: unknown): number => {
  if (value === "Sin Límite") return MAX_PAGE_SIZE;

  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;

  if (!Number.isFinite(numericValue)) return DEFAULT_PAGE_SIZE;

  const pageSize = Math.trunc(numericValue);
  if (pageSize >= MAX_PAGE_SIZE) return MAX_PAGE_SIZE;
  if (ALLOWED_PAGE_SIZES.includes(pageSize)) return pageSize;

  return DEFAULT_PAGE_SIZE;
};

export function useTablePagination(id?: string) {
  const storageKey = `table-pagination-${id || "default"}`;

  const [pageIndex, setPageIndex] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [isInitialized, setIsInitialized] = useState(false);

  // Save page size to localStorage whenever it changes
  const savePageSizeToStorage = useCallback(
    (newPageSize: number) => {
      if (typeof window === "undefined") return;

      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify(normalizeTablePageSize(newPageSize)),
        );
      } catch (error) {
        console.error("Error saving page size to localStorage:", error);
      }
    },
    [storageKey],
  );

  // Load page size from localStorage on initial render
  useEffect(() => {
    const getInitialPageSize = () => {
      if (typeof window === "undefined") return DEFAULT_PAGE_SIZE;

      try {
        const savedPageSize = localStorage.getItem(storageKey);
        if (savedPageSize) {
          const parsed = JSON.parse(savedPageSize);
          return normalizeTablePageSize(parsed);
        }
      } catch (error) {
        console.error("Error loading page size from localStorage:", error);
      }
      return DEFAULT_PAGE_SIZE;
    };

    setPageSize(getInitialPageSize());
    setIsInitialized(true);
  }, [storageKey]);

  // Custom setter that also saves to localStorage
  const handleSetPageSize = useCallback(
    (newPageSize: number) => {
      const normalizedPageSize = normalizeTablePageSize(newPageSize);
      setPageSize(normalizedPageSize);
      savePageSizeToStorage(normalizedPageSize);
      setPageIndex(1); // Reset to first page when changing page size
    },
    [savePageSizeToStorage],
  );

  return {
    pageIndex,
    pageSize,
    setPageIndex,
    setPageSize: handleSetPageSize,
    isInitialized,
  };
}
