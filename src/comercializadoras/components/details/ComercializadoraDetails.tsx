"use client";

import { ArrowLeft } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { Link } from "next-view-transitions";
import { useParams } from "next/navigation";

import { useComercializadora } from "@/comercializadoras/hooks/useComercializadora";
import { useComercializadoraViewNavigation } from "@/comercializadoras/hooks/useComercializadoraViewNavigation";
import { ComercializadoraNavigation } from "./ComercializadoraNavigation";
import { ComercializadoraMainView } from "./ComercializadoraMainView";
import { ComercializadoraTramitesTable } from "./ComercializadoraTramitesTable";
import { ComercializadoraDocumentsList } from "./ComercializadoraDocumentsList";
import FullScreenLoaderComponent from "@/core/components/FullScreenLoaderComponent";
import { User } from "@/core/types";
import { useUser } from "@/core/contexts/UserContext";

function ErrorState({ message }: { message: string }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center p-8 bg-white rounded-xl shadow-sm border max-w-md">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <ArrowLeft className="h-8 w-8 text-red-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Error al cargar
        </h3>
        <p className="text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

export default function ComercializadoraDetails() {
  const { userData } = useUser();
  const params = useParams();
  const { id } = params;

  // Usando hooks personalizados siguiendo el patrón de cliente
  const { comercializadora, loading, error, refetch } = useComercializadora(
    id,
    userData as User
  );
  const { currentView, setCurrentView } = useComercializadoraViewNavigation();

  if (loading) {
    return (
      <FullScreenLoaderComponent
        title="Cargando comercializadora..."
        description="Por favor, espera mientras se cargan los datos de la comercializadora."
      />
    );
  }

  if (error || !comercializadora) {
    return (
      <ErrorState
        message={error || "La comercializadora no se ha cargado correctamente."}
      />
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header con breadcrumb minimalista */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/comercializadoras" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm font-medium">Comercializadoras</span>
            </Link>
          </Button>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>/</span>
            <span className="font-medium text-gray-900">
              {comercializadora.name}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="px-6 py-8 space-y-8">
        {/* Navigation */}
        <ComercializadoraNavigation
          currentView={currentView}
          onViewChange={setCurrentView}
        />

        {/* Content based on current view */}
        {currentView === "main" && (
          <ComercializadoraMainView comercializadora={comercializadora} />
        )}

        {currentView === "tramites" && (
          <div className="space-y-6">
            <ComercializadoraTramitesTable
              name={comercializadora.name}
              userData={userData as User}
            />
          </div>
        )}

        {currentView === "documentos" && (
          <div className="space-y-6">
            <ComercializadoraDocumentsList
              files={comercializadora.files}
              userData={userData as User}
              comercializadora={comercializadora}
              refetch={refetch}
            />
          </div>
        )}
      </div>
    </div>
  );
}
