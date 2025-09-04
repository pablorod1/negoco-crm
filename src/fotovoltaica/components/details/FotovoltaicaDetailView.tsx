"use client";

import { Badge } from "@/core/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/core/components/ui/tabs";

import { Clock, CheckCircle, XCircle, AlertCircle, Loader } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { FotovoltaicaStatus, FotovoltaicaVM } from "@/fotovoltaica/types";
import { User } from "@/core/types";
import FullScreenLoaderComponent from "@/core/components/FullScreenLoaderComponent";
import { showCustomToast } from "@/core/components/CustomToast";
import { useUser } from "@/core/contexts/UserContext";
import FotovoltaicaClientTab from "./clientDetails/FotovoltaicaClientTab";
import FotovoltaicaDateDetails from "./FotovoltaicaDateDetails";
import FotovoltaicaComisionsDetailsTab from "./comisionDetails/FotovoltaicaComisionsDetailsTab";
import FotovoltaicaSalesPersonDetailsTab from "./salesPersonDetails/FotovoltaicaSalesPersonDetailsTab";
import FotovoltaicaLocationTab from "./FotovoltaicaLocationTab";
import TicketTabContent from "@/tickets/components/TicketTabContent";
import FotovoltaicaFilesTab from "./files/FotovoltaicaFilesTab";
import UpdateFotovoltaicaStatusDialog from "./UpdateFotovoltaicaStatusDialog";
import { formatUUID } from "@/core/utils/format";

const getStatusIcon = (status: FotovoltaicaStatus) => {
  switch (status) {
    case "pending":
      return <Clock className="h-4 w-4" />;

    case "processing":
      return <Loader className="h-4 w-4" />;
    case "completed":
      return <CheckCircle className="h-4 w-4" />;
    case "rejected":
      return <XCircle className="h-4 w-4" />;
    default:
      return <AlertCircle className="h-4 w-4" />;
  }
};

const getStatusColor = (status: FotovoltaicaStatus) => {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "processing":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "completed":
      return "bg-green-100 text-green-800 border-green-200";
    case "rejected":
      return "bg-red-100 text-red-800 border-red-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

const getStatusLabel = (status: FotovoltaicaStatus) => {
  switch (status) {
    case "pending":
      return "Pendiente";
    case "processing":
      return "En Proceso";
    case "completed":
      return "Completado";
    case "rejected":
      return "Rechazado";
    default:
      return "Desconocido";
  }
};

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

  const isComercial: boolean = userData?.role === "2";
  const isSubcomercial: boolean =
    userData?.role === "2" && userData?.super_id !== null;
  const isCompleted = fotovoltaica?.status === "completed";
  const isRejected = fotovoltaica?.status === "rejected";

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
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary-800">
            Solicitud Placas Solares
          </h1>
          <p className="text-primary-400">#{formatUUID(fotovoltaica.id)}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className={`${getStatusColor(fotovoltaica.status)} flex items-center gap-1`}
          >
            {getStatusIcon(fotovoltaica.status)}
            {getStatusLabel(fotovoltaica.status)}
          </Badge>
          {!isComercial && !isCompleted && !isRejected ? (
            <UpdateFotovoltaicaStatusDialog
              fotovoltaica={fotovoltaica}
              onSubmit={fetchFotovoltaica}
              userData={userData as User}
            />
          ) : null}
        </div>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="ubicacion">Ubicación</TabsTrigger>
          <TabsTrigger value="notas">Notas</TabsTrigger>
          <TabsTrigger value="archivos">Archivos</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Información del Cliente */}
            <FotovoltaicaClientTab
              fotovoltaica={fotovoltaica}
              onSubmit={fetchFotovoltaica}
              isComercial={isComercial}
              userData={userData as User}
            />

            {/* Fechas Importantes */}
            <FotovoltaicaDateDetails fotovoltaica={fotovoltaica} />

            {/* Información Financiera */}
            {!isSubcomercial ? (
              <FotovoltaicaComisionsDetailsTab
                fotovoltaica={fotovoltaica}
                isComercial={isComercial as boolean}
                onSubmit={fetchFotovoltaica}
                userData={userData as User}
              />
            ) : null}

            {/* Usuario Asignado */}
            <FotovoltaicaSalesPersonDetailsTab fotovoltaica={fotovoltaica} />
          </div>
        </TabsContent>

        <TabsContent value="ubicacion" className="space-y-6">
          <FotovoltaicaLocationTab fotovoltaica={fotovoltaica} />
        </TabsContent>

        <TabsContent value="notas" className="space-y-6">
          <TicketTabContent
            context="fotovoltaica"
            refId={fotovoltaica.id}
            assignedTo={fotovoltaica.user_id}
            userData={userData as User}
            onRefresh={fetchFotovoltaica}
          />
        </TabsContent>

        <TabsContent value="archivos" className="space-y-6">
          <FotovoltaicaFilesTab
            fotovoltaica={fotovoltaica}
            userData={userData as User}
            onSubmit={fetchFotovoltaica}
          />
        </TabsContent>
      </Tabs>
    </>
  );
}
