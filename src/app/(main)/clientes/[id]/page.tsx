"use client";

import { User } from "@/core/types";
import { useUser } from "@/core/contexts/UserContext";
import TicketTabContent from "@/tickets/components/TicketTabContent";
import FullScreenLoaderComponent from "@/core/components/FullScreenLoaderComponent";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { Link } from "next-view-transitions";

// Nuevos imports siguiendo el patrón de comparativas
import { useClientDetails } from "@/clientes/hooks/useClientDetails";
import { useClientViewNavigation } from "@/clientes/hooks/useClientViewNavigation";
import ClientNavigation from "@/clientes/components/details/ClientNavigation";
import ClientMainView from "@/clientes/components/details/ClientMainView";
import { ClientTramitesTable } from "@/clientes/components/details/ClientTramitesTable";
import { ClientFilesGrid } from "@/clientes/components/details/ClientFilesGrid";
import ClientError from "@/clientes/components/details/ClientError";

export default function ClientDetailsPage() {
  const { userData } = useUser();

  // Usando nuestros hooks personalizados siguiendo el patrón de comparativas
  const { client, loading, loadedData, fetchClient } = useClientDetails({
    userData,
  });
  const { currentView, setCurrentView } = useClientViewNavigation();

  if (loading || !loadedData || !client) {
    return (
      <FullScreenLoaderComponent
        title="Cargando cliente..."
        description="Por favor, espera mientras se cargan los datos del cliente."
      />
    );
  }

  // Show error state with more context
  if (!userData) {
    return <ClientError error="No hay datos de usuario" userData={userData} />;
  }

  return (
    <div className="min-h-screen ">
      {/* Header con breadcrumb minimalista */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/clientes" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm font-medium">Clientes</span>
            </Link>
          </Button>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>/</span>
            <span className="font-medium text-gray-900">
              {client.name} {client.last_name}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="px-6 py-8 space-y-8">
        {/* Navigation */}
        <ClientNavigation
          currentView={currentView}
          onViewChange={setCurrentView}
        />

        {/* Content based on current view */}
        {currentView === "main" && (
          <ClientMainView
            client={client}
            userData={userData as User}
            onUpdate={fetchClient}
          />
        )}

        {currentView === "tramites" && (
          <div className="space-y-6">
            <ClientTramitesTable client_id={client.id} />
          </div>
        )}

        {currentView === "files" && (
          <div className="space-y-6">
            <ClientFilesGrid client_id={client.id} />
          </div>
        )}

        {currentView === "tickets" && (
          <div className="space-y-6">
            <TicketTabContent
              context="cliente"
              refId={client.id}
              assignedTo={userData.id}
              userData={userData as User}
              onRefresh={fetchClient}
            />
          </div>
        )}
      </div>
    </div>
  );
}
