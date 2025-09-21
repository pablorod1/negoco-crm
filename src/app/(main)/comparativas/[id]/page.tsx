"use client";

import { useState } from "react";
import { User } from "@/core/types";
import { useUser } from "@/core/contexts/UserContext";
import TicketTabContent from "@/tickets/components/TicketTabContent";
import FullScreenLoaderComponent from "@/core/components/FullScreenLoaderComponent";
import { Button } from "@/core/components/ui/button";
import { cn } from "@/core/utils";

// Nuevos imports siguiendo el patrón de trámites
import { useComparativaDetails } from "@/comparativas/hooks/useComparativaDetails";
import { useViewNavigation } from "@/comparativas/hooks/useViewNavigation";
import {
  isEditableComparativa,
  isComercialEditableComparativa,
  isProcessedComparativa,
  hasNotesComparativa,
} from "@/comparativas/utils/permissions";
import ComparativaNavigation from "@/comparativas/components/details/ComparativaNavigation";
import MainView from "@/comparativas/components/details/MainView";
import { ComparativaNotesSection } from "@/comparativas/components/editComparativa/NotesTabContent";
import ComparativaChangesHistory from "@/comparativas/components/ComparativaChangesHistory";

export default function EditComparativaPage() {
  const { userData } = useUser();
  const isSubcomercial = userData?.role === "2" && userData?.super_id;
  const isAdmin = userData?.role === "admin";

  // Usando nuestros hooks personalizados siguiendo el patrón de trámites
  const { comparativa, loading, loadedData, fetchComparativa } =
    useComparativaDetails({
      userData,
    });
  const { currentView, setCurrentView } = useViewNavigation();

  const [ticketsViewState, setTicketsViewState] = useState<"tickets" | "notes">(
    "tickets"
  );

  // Calculando permisos y estados usando nuestras utilidades
  const isEditable = isEditableComparativa(comparativa, userData?.role);
  const isComercialEditable = isComercialEditableComparativa(
    comparativa,
    userData?.role
  );
  const isProcessed = isProcessedComparativa(comparativa);
  const hasNotes = hasNotesComparativa(comparativa);

  if (loading || !loadedData || !comparativa) {
    return (
      <FullScreenLoaderComponent
        title="Cargando comparativa..."
        description="Por favor, espera mientras se cargan los datos de la comparativa."
      />
    );
  }

  return (
    <div className="min-h-screen ">
      {/* Main Content Container */}
      <div className="px-6 py-8 space-y-8">
        {/* Navigation */}
        <ComparativaNavigation
          currentView={currentView}
          onViewChange={setCurrentView}
          isAdmin={isAdmin}
        />

        {/* Content based on current view */}
        {currentView === "main" && (
          <MainView
            comparativa={comparativa}
            userData={userData as User}
            onUpdate={fetchComparativa}
            isSubcomercial={isSubcomercial as boolean}
            isEditable={isEditable}
            isComercialEditable={isComercialEditable}
            isProcessed={isProcessed}
          />
        )}

        {currentView === "tickets" && (
          <div className="space-y-6">
            {hasNotes && (
              <div className="flex items-center gap-2 max-w-60 w-full">
                <Button
                  key={"tickets"}
                  onClick={() => setTicketsViewState("tickets")}
                  variant={
                    ticketsViewState === "tickets" ? "default" : "outline"
                  }
                  size="sm"
                  className={cn(
                    "flex-1",
                    ticketsViewState === "tickets"
                      ? "bg-gray-900 text-white shadow-sm"
                      : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                  )}
                >
                  Tickets
                </Button>
                <Button
                  key={"notes"}
                  onClick={() => setTicketsViewState("notes")}
                  variant={ticketsViewState === "notes" ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "flex-1",
                    ticketsViewState === "notes"
                      ? "bg-gray-900 text-white shadow-sm"
                      : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                  )}
                >
                  Notas
                </Button>
              </div>
            )}

            {ticketsViewState === "tickets" ? (
              <TicketTabContent
                context="comparativa"
                refId={comparativa.id}
                assignedTo={comparativa.user.id as string}
                userData={userData as User}
                onRefresh={fetchComparativa}
              />
            ) : (
              <ComparativaNotesSection
                notes={comparativa.notes}
                comparativaId={comparativa.id}
                onDeletedNote={fetchComparativa}
                onAddNote={fetchComparativa}
              />
            )}
          </div>
        )}

        {currentView === "history" && (
          <ComparativaChangesHistory
            comparativaId={comparativa.id}
            userData={userData as User}
          />
        )}
      </div>
    </div>
  );
}
