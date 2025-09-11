import { useState, useEffect, useCallback } from "react";

export function useTablePagination(id?: string) {
  const storageKey = `table-pagination-${id || "default"}`;

  const [pageIndex, setPageIndex] = useState(1);
  const [pageSize, setPageSize] = useState<number | string>(15);

  // Save page size to localStorage whenever it changes
  const savePageSizeToStorage = useCallback(
    (newPageSize: number | string) => {
      if (typeof window === "undefined") return;

      try {
        localStorage.setItem(storageKey, JSON.stringify(newPageSize));
      } catch (error) {
        console.error("Error saving page size to localStorage:", error);
      }
    },
    [storageKey]
  );

  // Load page size from localStorage on initial render
  useEffect(() => {
    const getInitialPageSize = () => {
      if (typeof window === "undefined") return 15;

      try {
        const savedPageSize = localStorage.getItem(storageKey);
        if (savedPageSize) {
          const parsed = JSON.parse(savedPageSize);
          return parsed;
        }
      } catch (error) {
        console.error("Error loading page size from localStorage:", error);
      }
      return 15;
    };

    const savedPageSize = getInitialPageSize();
    setPageSize(savedPageSize);
  }, [storageKey]);

  // Custom setter that also saves to localStorage
  const handleSetPageSize = useCallback(
    (newPageSize: number | string) => {
      setPageSize(newPageSize);
      savePageSizeToStorage(newPageSize);
      setPageIndex(1); // Reset to first page when changing page size
    },
    [savePageSizeToStorage]
  );

  return {
    pageIndex,
    pageSize,
    setPageIndex,
    setPageSize: handleSetPageSize,
  };
}
