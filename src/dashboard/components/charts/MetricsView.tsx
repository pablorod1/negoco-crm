"use client";
import type { User } from "@/core/types";

interface MetricsViewProps {
  loading: boolean;
  userData: User;
}

export function MetricsView({ loading, userData }: MetricsViewProps) {
  return <div>Métricas (placeholder)</div>;
}
