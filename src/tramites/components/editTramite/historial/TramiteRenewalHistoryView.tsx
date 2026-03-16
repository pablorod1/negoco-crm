"use client";

import React, { useEffect, useState, useMemo } from "react";
import { TramiteRenewalHistory as RenewalHistoryEntry } from "@/tramites/types";
import { useEnergySupplierNames } from "@/comercializadoras/hooks/useEnergySupplierById";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/core/components/ui/card";
import { Badge } from "@/core/components/ui/badge";
import { Separator } from "@/core/components/ui/separator";
import {
  RefreshCcw,
  ArrowRight,
  Building,
  Calendar,
  Loader2,
  UserIcon,
} from "lucide-react";
import { cn } from "@/core/utils";

interface Props {
  tramiteId: string;
  renewalCount: number;
}

export default function TramiteRenewalHistoryView({
  tramiteId,
  renewalCount,
}: Props) {
  const [entries, setEntries] = useState<RenewalHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Collect all unique company IDs from entries to resolve names in batch
  const companyIds = useMemo(() => {
    const ids = new Set<string>();
    entries.forEach((entry) => {
      if (entry.previous_company) ids.add(entry.previous_company);
      if (entry.new_company) ids.add(entry.new_company);
    });
    return Array.from(ids);
  }, [entries]);

  const { supplierNames } = useEnergySupplierNames(companyIds);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/v2/contracts/${tramiteId}/renewal-history`,
        );
        const { success, data } = await res.json();
        if (success && data) {
          setEntries(data);
        }
      } catch (err) {
        console.error("Error fetching renewal history:", err);
      } finally {
        setLoading(false);
      }
    };

    if (renewalCount > 0) {
      fetchHistory();
    } else {
      setLoading(false);
    }
  }, [tramiteId, renewalCount]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    try {
      return new Date(dateString).toLocaleDateString("es-ES", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const formatFullDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString("es-ES", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3 text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Cargando historial de renovaciones...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (entries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-gray-800 text-lg font-semibold">
            <RefreshCcw className="h-5 w-5 text-gray-600" />
            Historial de Renovaciones
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center text-gray-500">
            <RefreshCcw className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>Este trámite no ha sido renovado</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-gray-800 text-lg font-semibold">
          <RefreshCcw className="h-5 w-5 text-gray-600" />
          Historial de Renovaciones
          <Badge variant="warning" className="ml-auto tabular-nums">
            {entries.length}{" "}
            {entries.length === 1 ? "renovación" : "renovaciones"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-4">
          {entries.map((entry, index) => {
            const isLast = index === entries.length - 1;

            return (
              <div key={entry.id}>
                <div className="flex gap-4">
                  {/* Left: renewal number indicator */}
                  <div className="flex flex-col items-center">
                    <div className="flex items-center justify-center w-9 h-9 rounded-full bg-amber-100 border-2 border-amber-300 text-amber-700 font-bold text-sm tabular-nums">
                      #{entry.renewal_number}
                    </div>
                    {!isLast && (
                      <div className="w-0.5 flex-1 bg-amber-200 mt-2" />
                    )}
                  </div>

                  {/* Right: renewal details */}
                  <div className="flex-1 pb-4">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">
                          Renovación #{entry.renewal_number}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatFullDate(entry.created_at)}
                        </p>
                      </div>
                      {entry.user_name && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <UserIcon className="h-3 w-3" />
                          {entry.user_name}
                        </div>
                      )}
                    </div>

                    {/* Date changes */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                      <div className="bg-gray-50 rounded-lg border border-gray-200 p-3">
                        <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Activación
                        </p>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-gray-500 line-through">
                            {formatDate(entry.previous_activation_date)}
                          </span>
                          <ArrowRight className="h-3 w-3 text-gray-400 flex-shrink-0" />
                          <span className="font-medium text-gray-800">
                            {formatDate(entry.new_activation_date)}
                          </span>
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded-lg border border-gray-200 p-3">
                        <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Renovación
                        </p>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-gray-500 line-through">
                            {formatDate(entry.previous_renovation_date)}
                          </span>
                          <ArrowRight className="h-3 w-3 text-gray-400 flex-shrink-0" />
                          <span className="font-medium text-gray-800">
                            {formatDate(entry.new_renovation_date)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* State snapshot + company */}
                    <div className="flex flex-wrap items-center gap-2">
                      {entry.company_changed && (
                        <Badge variant="info" className={cn("text-xs gap-1")}>
                          <Building className="h-3 w-3" />
                          Cambio:{" "}
                          {entry.previous_company
                            ? (supplierNames[entry.previous_company] || entry.previous_company)
                            : "—"}{" "}
                          →{" "}
                          {entry.new_company
                            ? (supplierNames[entry.new_company] || entry.new_company)
                            : "—"}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {!isLast && <Separator className="ml-13" />}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
