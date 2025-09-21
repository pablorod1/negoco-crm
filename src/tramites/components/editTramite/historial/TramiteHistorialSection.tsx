"use client";

import React, { useState } from "react";
import { TramiteDB } from "@/tramites/types";
import { User } from "@/core/types";
import { Button } from "@/core/components/ui/button";
import { Clock, History } from "lucide-react";
import { cn } from "@/core/utils";
import TramiteTimeLine from "./TramiteTimeLine";
import TramiteChangesHistory from "./TramiteChangesHistory";

interface Props {
  tramite: TramiteDB;
  userData: User;
  isComercial: boolean;
  onUpdate?: () => void;
  userIsAdmin?: boolean;
}

type HistorialView = "timeline" | "changes";

export default function TramiteHistorialSection({
  tramite,
  userData,
  isComercial,
  onUpdate,
  userIsAdmin = false,
}: Props) {
  const [currentView, setCurrentView] = useState<HistorialView>("timeline");

  return (
    <div className="space-y-6">
      {/* View Toggle */}
      <div className="flex items-center gap-2 max-w-80 w-full">
        <Button
          onClick={() => setCurrentView("timeline")}
          variant={currentView === "timeline" ? "default" : "outline"}
          size="sm"
          className={cn(
            "flex-1 flex items-center gap-2",
            currentView === "timeline"
              ? "bg-gray-900 text-white shadow-sm"
              : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
          )}
        >
          <Clock className="h-4 w-4" />
          Timeline del Trámite
        </Button>
        {userIsAdmin ? (
          <Button
            onClick={() => setCurrentView("changes")}
            variant={currentView === "changes" ? "default" : "outline"}
            size="sm"
            className={cn(
              "flex-1 flex items-center gap-2",
              currentView === "changes"
                ? "bg-gray-900 text-white shadow-sm"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            )}
          >
            <History className="h-4 w-4" />
            Historial de Cambios
          </Button>
        ) : null}
      </div>

      {/* Content */}
      {currentView === "timeline" ? (
        <TramiteTimeLine
          tramite={tramite}
          isComercial={isComercial}
          onUpdate={onUpdate}
        />
      ) : null}

      {currentView === "changes" && userIsAdmin ? (
        <TramiteChangesHistory tramiteId={tramite.id} userData={userData} />
      ) : null}
    </div>
  );
}
