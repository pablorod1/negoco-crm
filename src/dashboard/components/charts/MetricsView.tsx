"use client";

import type { User } from "@/core/types";
import { ComparativasRatio } from "./ComparativasRatio";
import { RenovacionTarifaCard } from "./RenovacionTarifaCard";
import { TicketComisionMediaCard } from "./TicketComisionMediaCard";

interface MetricsViewProps {
  loading: boolean;
  userData: User;
  hasSubComerciales?: boolean;
}

export function MetricsView({
  loading,
  userData,
  hasSubComerciales = false,
}: MetricsViewProps) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <div className="lg:col-span-2">
        <ComparativasRatio
          userData={userData}
          loading={loading}
          hasSubComerciales={hasSubComerciales}
        />
      </div>
      <TicketComisionMediaCard
        loading={loading}
        userData={userData}
        hasSubComerciales={hasSubComerciales}
      />
      <RenovacionTarifaCard
        loading={loading}
        userData={userData}
        hasSubComerciales={hasSubComerciales}
      />
    </div>
  );
}
