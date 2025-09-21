"use client";

import { useState } from "react";
import { useEffect, useCallback } from "react";
import { User } from "@/core/types";
import FullScreenLoaderComponent from "@/core/components/FullScreenLoaderComponent";
import { showCustomToast } from "@/core/components/CustomToast";
import { useUser } from "@/core/contexts/UserContext";
import { AlertCircle } from "lucide-react";
import { FotovoltaicaVM } from "@/fotovoltaica/types";

// Componentes rediseñados siguiendo el patrón de comparativas
import FotovoltaicaNavigation from "./navigation/FotovoltaicaNavigation";
import FotovoltaicaMainView from "./main/FotovoltaicaMainView";
import TicketTabContent from "@/tickets/components/TicketTabContent";
import FotovoltaicaFilesTab from "./files/FotovoltaicaFilesTab";

type LoadingState = {
  loading: boolean;
  error: string | null;
  notFound: boolean;
};

const NotFoundComponent = ({ id }: { id: string }) => (
  <div className="text-center py-12">
    <h2 className="text-2xl font-semibold">Solicitud no encontrada</h2>
    <p className="text-muted-foreground mt-2">
      La solicitud fotovoltaica con ID #{id} no existe o ha sido eliminada.
    </p>
  </div>
);

export function FotovoltaicaDetailView({ id }: { id: string }) {
  const { userData } = useUser();
  const [fotovoltaica, setFotovoltaica] = useState<FotovoltaicaVM | null>(null);
  const [state, setState] = useState<LoadingState>({
    loading: true,
    error: null,
    notFound: false,
  });

  // Usando el patrón de comparativas para navegación
  const [currentView, setCurrentView] = useState<
    "main" | "tickets" | "files" | "history"
  >("main");

  const isAdmin = userData?.role === "admin" || userData?.role === "1";
  const isSubcomercial: boolean =
    userData?.role === "2" && userData?.super_id !== null;

  const handleFetchError = (error: string) => {
    showCustomToast({
      title: "Error al cargar la solicitud",
      message: error,
      icon: AlertCircle,
      iconSize: 24,
      iconColor: "var(--danger-color)",
    });
    setState({ loading: false, error, notFound: false });
  };

  const handleNotFound = useCallback(() => {
    showCustomToast({
      title: "Solicitud no encontrada",
      message: `No se encontró la solicitud fotovoltaica con ID ${id}.`,
      icon: AlertCircle,
      iconSize: 24,
      iconColor: "var(--danger-color)",
    });
    setState({ loading: false, error: null, notFound: true });
  }, [id]);

  const fetchFotovoltaica = useCallback(async () => {
    if (!userData) return;

    setState({ loading: true, error: null, notFound: false });

    try {
      const response = await fetch(`/api/v2/solar-installations/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userData.id,
          user_role: userData.role,
        }),
      });
      const { success, error, data } = await response.json();
      if (!success) {
        handleFetchError(
          error || "No se pudo obtener la solicitud fotovoltaica."
        );
        return;
      }

      if (!data) {
        handleNotFound();
        return;
      }
      setFotovoltaica(data);
      setState({ loading: false, error: null, notFound: false });
    } catch (error) {
      console.error("Error fetching fotovoltaica:", error);
      handleFetchError("Error de conexión al cargar la solicitud.");
    }
  }, [id, userData, handleNotFound]);

  useEffect(() => {
    fetchFotovoltaica();
  }, [fetchFotovoltaica]);

  if (state.loading) {
    return <FullScreenLoaderComponent />;
  }

  if (state.notFound || (state.error && !fotovoltaica)) {
    return <NotFoundComponent id={id} />;
  }

  if (!fotovoltaica) {
    return <NotFoundComponent id={id} />;
  }

  return (
    <div className="min-h-screen ">
      {/* Main Content Container */}
      <div className="px-6 py-8 space-y-8">
        {/* Navigation */}
        <FotovoltaicaNavigation
          currentView={currentView}
          onViewChange={setCurrentView}
          isAdmin={isAdmin}
        />

        {/* Content based on current view */}
        {currentView === "main" && (
          <FotovoltaicaMainView
            fotovoltaica={fotovoltaica}
            userData={userData as User}
            onUpdate={fetchFotovoltaica}
            isSubcomercial={isSubcomercial}
          />
        )}

        {currentView === "tickets" && (
          <div className="space-y-6">
            <TicketTabContent
              context="fotovoltaica"
              refId={fotovoltaica.id}
              assignedTo={fotovoltaica.user_id}
              userData={userData as User}
              onRefresh={fetchFotovoltaica}
            />
          </div>
        )}

        {currentView === "files" && (
          <div className="space-y-6">
            <FotovoltaicaFilesTab
              fotovoltaica={fotovoltaica}
              userData={userData as User}
              onSubmit={fetchFotovoltaica}
            />
          </div>
        )}

        {currentView === "history" && isAdmin && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Historial de Cambios
              </h3>
              <p className="text-gray-600">
                Funcionalidad de historial próximamente disponible.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
