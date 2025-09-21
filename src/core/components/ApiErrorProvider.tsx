"use client";

import { useApiErrorHandler } from "@/core/hooks/useApiErrorHandler";

export function ApiErrorProvider({ children }: { children: React.ReactNode }) {
  useApiErrorHandler();
  return <>{children}</>;
}
