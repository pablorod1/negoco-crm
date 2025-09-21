import React, { useState } from "react";
import {
  TicketItem,
  TicketViewToggle,
  CreateTicketDialog,
  useTickets,
} from "@/tickets";
import { User as UserType } from "@/core/types";
import { Checkbox } from "@/core/components/ui/checkbox";
import { Label } from "@/core/components/ui/label";
import { Skeleton } from "@/core/components/ui/skeleton";

interface TicketTabContentProps {
  context: "tramite" | "cliente" | "fotovoltaica" | "comparativa";
  refId: string;
  assignedTo: string; // ID of the user to whom tickets are assigned
  userData: UserType;
  client?: unknown; // Replace with proper ClientDB type if available
  onRefresh?: () => void;
}

type TicketView = "incidencias" | "notas";

const TicketTabContent: React.FC<TicketTabContentProps> = ({
  context,
  refId,
  assignedTo,
  userData,
  onRefresh,
}) => {
  const [activeView, setActiveView] = useState<TicketView>("incidencias");
  const [includeInternal, setIncludeInternal] = useState<boolean>(
    userData.role !== "2" // Comercial users don't see internal by default
  );

  const isComercial = userData.role === "2";

  // Use custom hook for tickets
  const { incidencias, notas, isLoading, refreshTickets } = useTickets({
    userData,
    context,
    refId,
    includeInternal,
  });

  const handleTicketCreated = () => {
    refreshTickets();
    onRefresh?.();
  };

  const handleTicketUpdated = () => {
    refreshTickets();
    onRefresh?.();
  };

  const handleTicketDeleted = () => {
    refreshTickets();
    onRefresh?.();
  };

  // Get tickets for current view
  const currentTickets = activeView === "incidencias" ? incidencias : notas;

  return (
    <div className="space-y-8 p-1">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
            Tickets
          </h2>
          <p className="text-gray-600 leading-relaxed">
            Gestiona consultas, incidencias y solicitudes de manera eficiente
          </p>
        </div>
        <CreateTicketDialog
          context={context}
          refId={refId}
          userData={userData}
          assignedTo={assignedTo}
          defaultType={activeView === "notas" ? "note" : "incidencia"}
          onTicketCreated={handleTicketCreated}
        />
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="w-full">
          <TicketViewToggle
            currentView={activeView}
            onViewChange={setActiveView}
            incidenciasCount={incidencias.length}
            notasCount={notas.length}
          />
        </div>

        {/* Checkbox para tickets internos - solo para vista de notas y usuarios no comerciales */}
        {activeView === "notas" && !isComercial && (
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-internal"
                checked={includeInternal}
                onCheckedChange={(checked) =>
                  setIncludeInternal(checked as boolean)
                }
              />
              <Label
                htmlFor="include-internal"
                className="text-sm font-medium text-gray-700"
              >
                Mostrar notas internas
              </Label>
            </div>
          </div>
        )}
      </div>

      {/* Content based on active view */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-2xl" />
            ))}
          </div>
        ) : currentTickets.length === 0 ? (
          <div className="text-center py-16">
            <div className="bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <div className="h-8 w-8 text-gray-400">📝</div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No hay {activeView === "incidencias" ? "incidencias" : "notas"}
            </h3>
            <p className="text-gray-600 max-w-md mx-auto">
              {activeView === "incidencias"
                ? "No se han registrado incidencias para este elemento."
                : "No se han creado notas para este elemento."}
            </p>
          </div>
        ) : (
          currentTickets.map((ticket) => (
            <TicketItem
              key={ticket.id}
              ticket={ticket}
              userData={userData}
              onTicketUpdated={handleTicketUpdated}
              onTicketDeleted={handleTicketDeleted}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default TicketTabContent;
