"use client";

import React, { useState } from "react";
import { TramiteDB } from "@/tramites/types";
import { User } from "@/core/types";
import { Button } from "@/core/components/ui/button";
import { Badge } from "@/core/components/ui/badge";
import { Clock, History, RefreshCcw } from "lucide-react";
import { cn } from "@/core/utils";
import TramiteTimeLine from "./TramiteTimeLine";
import TramiteChangesHistory from "./TramiteChangesHistory";
import TramiteRenewalHistoryView from "./TramiteRenewalHistoryView";

interface Props {
  tramite: TramiteDB;
  userData: User;
  isComercial: boolean;
  onUpdate?: () => void;
  userIsAdmin?: boolean;
}

type HistorialView = "timeline" | "changes" | "renewals";

export default function TramiteHistorialSection({
  tramite,
  userData,
  isComercial,
  onUpdate,
  userIsAdmin = false,
}: Props) {
  const [currentView, setCurrentView] = useState<HistorialView>("timeline");
  const renewalCount = tramite.renewal_count || 0;

  return (
    <div className="space-y-6">
      {/* View Toggle */}
      <div className="flex items-center gap-2 max-w-full w-full flex-wrap">
        <Button
          onClick={() => setCurrentView("timeline")}
          variant={currentView === "timeline" ? "default" : "outline"}
          size="sm"
          className={cn(
            "flex items-center gap-2",
            currentView === "timeline"
              ? "bg-gray-900 text-white shadow-sm"
              : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
          )}
        >
          <Clock className="h-4 w-4" />
          Timeline
        </Button>
        {userIsAdmin ? (
          <Button
            onClick={() => setCurrentView("changes")}
            variant={currentView === "changes" ? "default" : "outline"}
            size="sm"
            className={cn(
              "flex items-center gap-2",
              currentView === "changes"
                ? "bg-gray-900 text-white shadow-sm"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            )}
          >
            <History className="h-4 w-4" />
            Historial de Cambios
          </Button>
        ) : null}
        {renewalCount > 0 && (
          <Button
            onClick={() => setCurrentView("renewals")}
            variant={currentView === "renewals" ? "default" : "outline"}
            size="sm"
            className={cn(
              "flex items-center gap-2",
              currentView === "renewals"
                ? "bg-gray-900 text-white shadow-sm"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            )}
          >
            <RefreshCcw className="h-4 w-4" />
            Renovaciones
            <Badge
              variant={currentView === "renewals" ? "secondary" : "warning"}
              className="ml-0.5 tabular-nums text-xs px-1.5 py-0"
            >
              {renewalCount}
            </Badge>
          </Button>
        )}
      </div>

      {/* Content */}
      {currentView === "timeline" && (
        <TramiteTimeLine
          tramite={tramite}
          isComercial={isComercial}
          onUpdate={onUpdate}
          userData={userData}
        />
      )}

      {currentView === "changes" && userIsAdmin && (
        <TramiteChangesHistory tramiteId={tramite.id} userData={userData} />
      )}

      {currentView === "renewals" && renewalCount > 0 && (
        <TramiteRenewalHistoryView
          tramiteId={tramite.id}
          renewalCount={renewalCount}
        />
      )}
    </div>
  );
}
