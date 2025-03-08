import { useState } from "react";

export function useTablePagination() {
  const [pagination, setPagination] = useState({
    pageIndex: 1,
    pageSize: 15,
  });

  return {
    pagination,
    setPagination,
  };
}
