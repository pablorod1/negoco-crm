"use client";

import { useState } from "react";
import { TramiteFile } from "@/tramites/types/tramite.types";
import { User } from "@/core/types";
import { useUser } from "@/core/contexts/UserContext";
import TicketTabContent from "@/tickets/components/TicketTabContent";
import TramiteFilesSection from "@/tramites/components/editTramite/files/TramitesFilesSection";
import TramiteHistorialSection from "@/tramites/components/editTramite/historial/TramiteHistorialSection";
import TramiteClientSection from "@/tramites/components/editTramite/client/TramiteClientSection";
import FullScreenLoaderComponent from "@/core/components/FullScreenLoaderComponent";
import { TramiteNotesSection } from "@/tramites/components/editTramite/notes/NotesTabContent";
import { Button } from "@/core/components/ui/button";

import { cn } from "@/core/utils";

// Nuevos imports de nuestros hooks y componentes
import { useTramiteDetails } from "@/tramites/hooks/useTramiteDetails";
import { useViewNavigation } from "@/tramites/hooks/useViewNavigation";
import {
  isEditableTramite,
  isComercialEditableTramite,
  isRenewableTramite,
  isActiveTramite,
  hasNotes,
  isAdminUser,
} from "@/tramites/utils/permissions";
import TramiteNavigation from "@/tramites/components/details/TramiteNavigation";
import MainView from "@/tramites/components/details/MainView";

export default function TramiteDetails() {
  const { userData } = useUser();
  const isSubcomercial = userData && userData.role === "2" && userData.super_id;

  // Usando nuestros hooks personalizados
  const { formData, loading, loadedData, fetchTramite } = useTramiteDetails({
    userData,
  });
  const { currentView, setCurrentView } = useViewNavigation();

  const [ticketsViewState, setTicketsViewState] = useState<"tickets" | "notes">(
    "tickets"
  );

  const { tramite, client, contracts, files, signer } = formData;

  // Calculando permisos y estados usando nuestras utilidades
  const isEditable = isEditableTramite(formData, userData?.role);
  const isComercialEditable = isComercialEditableTramite(
    formData,
    userData?.role
  );
  const isRenewable = isRenewableTramite(formData);
  const isActive = isActiveTramite(formData);
  const userIsAdmin = isAdminUser(userData?.role);
  const isComercial = userData && userData.role === "2";

  if (loading || !loadedData) {
    return (
      <FullScreenLoaderComponent
        title="Cargando trámite..."
        description="Espere unos segundos mientras se cargan los datos del trámite."
      />
    );
  }

  return (
    <div className="min-h-screen ">
      {/* Main Content Container */}
      <div className="px-6 py-8 space-y-8">
        {/* Navigation */}
        <TramiteNavigation
          currentView={currentView}
          onViewChange={setCurrentView}
        />

        {/* Content based on current view */}
        {currentView === "main" && (
          <MainView
            tramite={tramite}
            client={client}
            contracts={contracts}
            userData={userData as User}
            onUpdate={fetchTramite}
            isEditable={isEditable}
            isComercialEditable={isComercialEditable}
            isRenewable={isRenewable}
            isActive={isActive}
            isSubcomercial={!!isSubcomercial}
          />
        )}

        {currentView === "cliente" && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <TramiteClientSection
              client={client}
              signer={signer}
              onUpdated={fetchTramite}
              isEditable={isEditable as boolean}
              tramite_id={tramite.id}
            />
          </div>
        )}

        {currentView === "documentos" && (
          <TramiteFilesSection
            files={files as TramiteFile[]}
            userData={userData as User}
            tramite={tramite}
            onUpload={fetchTramite}
            isEditable={isEditable}
            client={client}
          />
        )}

        {currentView === "tickets" && (
          <div className="space-y-6">
            {hasNotes(formData) && (
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
                context="tramite"
                refId={tramite.id}
                assignedTo={tramite.user_id}
                userData={userData as User}
                onRefresh={fetchTramite}
              />
            ) : (
              <TramiteNotesSection
                notes={tramite.notes}
                onDeletedNote={fetchTramite}
                onAddNote={fetchTramite}
                userData={userData as User}
                tramite_id={tramite.id}
                client={client}
                internalNotes={tramite.internal_notes}
              />
            )}
          </div>
        )}

        {currentView === "historial" && (
          <TramiteHistorialSection
            tramite={tramite}
            userData={userData as User}
            isComercial={isComercial as boolean}
            onUpdate={fetchTramite}
            userIsAdmin={userIsAdmin}
          />
        )}
      </div>
    </div>
  );
}
