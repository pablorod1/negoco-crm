"use client";
import { useUser } from "@/lib/contexts/UserContext";
import { ComparativaFile, ComparativaVM, User } from "@/lib/core/types";
import {
  Calendar,
  CheckCircle,
  ClipboardList,
  CloudAlert,
  LucideUser,
  ShieldAlert,
  Tag,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AvatarComponent from "@/components/core/AvatarComponent";
import { Separator } from "@/components/ui/separator";
import { formatDateTime } from "@/lib/core/format";
import { showCustomToast } from "@/components/core/CustomToast";
import UploadComparativaFilesModal from "@/components/comparativas/editComparativa/UploadComparativaFilesModal";
import { generateComparativaUpdatedNotification } from "@/lib/core/notifications.helpers";
import UpdateComissionsModal from "@/components/comparativas/editComparativa/UpdateComissionsModal";
import { ComparativaNotesSection } from "@/components/comparativas/editComparativa/NotesTabContent";
import { ServiceInfo } from "@/components/comparativas/editComparativa/ServiceInfo";
import { FilesList } from "@/components/comparativas/editComparativa/FilesList";
import { CommissionsTabContent } from "@/components/comparativas/editComparativa/ComissionsTabContent";
import UpdateComparativaStatusModal from "@/components/comparativas/editComparativa/UpdateComparativaStatusModal";
import Link from "next/link";
import { getStatusBadge } from "@/lib/hooks/use-status-badge";
import TooltipComponent from "@/components/core/TooltipComponent";
import AddTramiteDialog from "@/components/tramites/createTramite/AddTramiteDialog";
import FullScreenLoaderComponent from "@/components/core/FullScreenLoaderComponent";

export default function EditComparativaPage() {
  const { userData } = useUser();
  const { id } = useParams();
  const [comparativa, setComparativa] = useState<ComparativaVM>();
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const isAdmin = userData?.role === "admin";
  const isBackOffice = userData?.role === "1";
  const isComercial = userData?.role === "2";
  const isSubcomercial = userData?.role === "2" && userData?.super_id;

  const fetchComparativa = useCallback(async () => {
    if (!userData?.id || !userData?.role) return;

    try {
      setLoading(true);
      const rs = await fetch(`/api/comparativas/get/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          user_id: userData.id,
          user_role: userData.role,
        }),
      });

      if (rs.status === 404) {
        showCustomToast({
          title: "Acceso denegado",
          message:
            "La comparativa no existe o no tienes permiso para acceder a ella.",
          iconColor: "var(--danger-color)",
          icon: ShieldAlert,
          iconSize: 24,
        });
        router.push("/comparativas");
        return;
      }

      if (!rs.ok) {
        const errorData = await rs.json();
        showCustomToast({
          title: "Error",
          message: errorData.error || "Error al cargar la comparativa",
          icon: CloudAlert,
          iconSize: 24,
          iconColor: "var(--danger-color)",
        });
        router.push("/comparativas");
        return;
      }

      const { success, data } = await rs.json();
      if (success && data) {
        setComparativa(data);
      } else {
        showCustomToast({
          title: "Error",
          message: "No se encontraron datos de la comparativa",
          icon: CloudAlert,
          iconSize: 24,
          iconColor: "var(--danger-color)",
        });
        router.push("/comparativas");
        return;
      }
    } catch (error) {
      console.error("Error en la solicitud:", error);
      showCustomToast({
        title: "Error",
        message: "Error de conexión",
        icon: CloudAlert,
        iconSize: 24,
        iconColor: "var(--danger-color)",
      });
      router.push("/comparativas");
      return;
    } finally {
      setLoading(false);
    }
  }, [id, userData?.id, userData?.role, router]);

  const handleAddNewNote = async (note: string) => {
    if (!comparativa) return;

    try {
      const rs = await fetch(`/api/comparativas/add/notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: comparativa.notes,
          note,
          id,
        }),
      });

      const { success, error } = await rs.json();

      if (!success) {
        showCustomToast({
          title: "Error al añadir la nota",
          message: error,
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: CloudAlert,
        });
        return;
      }

      const notification = generateComparativaUpdatedNotification({
        comparativa_id: comparativa.id,
        client: comparativa.client,
        user_id: comparativa.user.id as string,
        notes: true,
      });

      const response = await fetch(`/api/notifications/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notification }),
      });

      const { success: notifySuccess, error: notifyError } =
        await response.json();

      if (!notifySuccess && notifyError) {
        showCustomToast({
          title: "Error al notificar cambios",
          message: notifyError,
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: CloudAlert,
        });
        return;
      }

      showCustomToast({
        title: "Nota añadida",
        message: `La nota se ha añadido correctamente.\n\nSe ha notificado a ${comparativa.user.name}.`,
        iconColor: "var(--success-color)",
        iconSize: 24,
        icon: CheckCircle,
      });

      fetchComparativa();
    } catch (error) {
      console.error(error);
      showCustomToast({
        title: "Error al añadir la nota",
        message: "Inténtalo de nuevo más tarde.",
        iconColor: "var(--danger-color)",
        iconSize: 24,
        icon: CloudAlert,
      });
    }
  };

  useEffect(() => {
    fetchComparativa();
  }, [fetchComparativa]);

  if (loading || !comparativa) {
    return (
      <FullScreenLoaderComponent
        title="Cargando comparativa..."
        description="Por favor, espera mientras se cargan los datos de la comparativa."
      />
    );
  }

  const isEditable =
    !isComercial &&
    comparativa.status !== "processed" &&
    comparativa.status !== "rejected";

  const isStudied = comparativa.status === "completed";
  const isProcessed = comparativa.status === "processed";

  return (
    <div className="mx-12 py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary-800">
            Detalles de Comparativa
          </h1>
          <p className="text-primary-400">ID: {comparativa.id}</p>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(comparativa.status)}
          {comparativa.status === "processed" && comparativa.tramite_id && (
            <TooltipComponent content="Ver Trámite">
              <Link
                href={`/tramites/${comparativa.tramite_id}`}
                className="flex items-center gap-1 ml-4 text-primary-400 hover:underline hover:text-primary-500"
              >
                <ClipboardList className="h-4 w-4" />
                <span>Trámite: {comparativa.tramite_id}</span>
              </Link>
            </TooltipComponent>
          )}

          {comparativa.status !== "completed" &&
          comparativa.status !== "processed" &&
          !isComercial ? (
            <UpdateComparativaStatusModal
              comparativa={comparativa}
              onUpdate={fetchComparativa}
              userData={userData as User}
            />
          ) : comparativa.status === "completed" ? (
            <AddTramiteDialog
              variant="outline"
              comparativa={comparativa}
              onComparativaUpdated={fetchComparativa}
            />
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl text-primary-800">
                  {comparativa.client}
                </CardTitle>
                <CardDescription className="flex items-center gap-1 mt-1">
                  <ServiceInfo service={comparativa.service} />
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="notes">
              <TabsList
                className={`grid mb-4 ${(isStudied || isProcessed) && !isSubcomercial ? "grid-cols-2" : "grid-cols-1"}`}
              >
                <TabsTrigger value="notes">
                  Notas - {comparativa.notes.length}
                </TabsTrigger>

                {(isStudied || isProcessed) && !isSubcomercial && (
                  <TabsTrigger value="commissions">Comisiones</TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="commissions" className="space-y-4">
                {!isSubcomercial && (
                  <CommissionsTabContent
                    comparativa={comparativa}
                    userData={userData as User}
                  />
                )}
                {(isAdmin || isBackOffice) && isEditable && (
                  <UpdateComissionsModal
                    onUpdate={fetchComparativa}
                    comparativa={comparativa}
                  />
                )}
              </TabsContent>

              <TabsContent value="notes">
                <ComparativaNotesSection
                  notes={comparativa.notes}
                  comparativaId={comparativa.id}
                  onDeletedNote={fetchComparativa}
                  onAddNote={handleAddNewNote}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* User and Date Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-primary-800">
              Información Adicional
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* User Info */}
            <div className="space-y-3">
              <h3 className="font-light flex items-center gap-2 text-primary-800">
                <LucideUser className="h-4 w-4" />
                <span>Creado por</span>
              </h3>

              <div className="flex items-center gap-3">
                <AvatarComponent
                  userData={comparativa.user as User}
                  className="!rounded-full"
                />
                <div>
                  <p className="font-medium text-primary-900">
                    {comparativa.user.name}
                  </p>
                  <p className="text-sm text-primary-400">
                    {comparativa.user.email}
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Date Info */}
            <div className="space-y-3">
              <h3 className="font-light flex items-center gap-2 text-primary-800">
                <Calendar className="h-4 w-4" />
                <span>Fecha de Creación</span>
              </h3>
              <p className="text-primary-900">
                {formatDateTime(comparativa.creation_date)}
              </p>
            </div>

            <Separator />

            {/* Status Info */}
            <div className="space-y-3">
              <h3 className="font-light flex items-center gap-2 text-primary-800">
                <Tag className="h-4 w-4" />
                <span>Estado</span>
              </h3>
              <div>{getStatusBadge(comparativa.status)}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Files Section */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-primary-800">Archivos Adjuntos</CardTitle>
          <CardDescription className="text-primary-400">
            {comparativa.files.length} archivo
            {comparativa.files.length !== 1 ? "s" : ""} adjunto
            {comparativa.files.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FilesList
            files={(comparativa.files as ComparativaFile[]) || []}
            comparativa_id={comparativa.id}
            organization_id={userData?.organization.id as string}
            onDeleted={fetchComparativa}
            isComercial={isComercial as boolean}
            isProcessed={isProcessed as boolean}
          />
        </CardContent>
        <CardFooter>
          {(isEditable ||
            (isComercial && comparativa.status === "pending")) && (
            <UploadComparativaFilesModal
              onUpload={fetchComparativa}
              status={comparativa.status}
              userData={userData as User}
              comparativa={comparativa}
            />
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
