"use client";
import { useUser } from "@/lib/contexts/UserContext";
import {
  ComparativaFile,
  ComparativaStatus,
  ComparativaVM,
  User,
} from "@/lib/core/types";
import { Spinner } from "@heroui/spinner";
import {
  Calendar,
  CheckCircle,
  CloudAlert,
  LucideUser,
  Tag,
} from "lucide-react";
import { useParams } from "next/navigation";
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
import { Divider } from "@heroui/divider";
import { formatDateTime } from "@/lib/core/format";
import { Chip } from "@heroui/chip";
import { showCustomToast } from "@/components/core/CustomToast";
import UploadComparativaFilesModal from "@/components/comparativas/editComparativa/UploadComparativaFilesModal";
import { generateComparativaUpdatedNotification } from "@/lib/core/notifications.helpers";
import UpdateComissionsModal from "@/components/comparativas/editComparativa/UpdateComissionsModal";
import { NotesSection } from "@/components/comparativas/editComparativa/NotesTabContent";
import { ServiceInfo } from "@/components/comparativas/editComparativa/ServiceInfo";
import { FilesList } from "@/components/comparativas/editComparativa/FilesList";
import { CommissionsTabContent } from "@/components/comparativas/editComparativa/ComissionsTabContent";
import UpdateComparativaStatusModal from "@/components/comparativas/editComparativa/UpdateComparativaStatusModal";
import ComparativaToTramite from "@/components/comparativas/editComparativa/ComparativaToTramite";

const STATUS_BADGES = {
  pending: (
    <Chip variant="flat" color="warning">
      Pendiente de Estudio
    </Chip>
  ),
  completed: (
    <Chip variant="flat" color="success">
      Estudio Realizado
    </Chip>
  ),
  processed: (
    <Chip
      variant="flat"
      color="primary"
      className="bg-[var(--primary-color-100)]"
    >
      Comparativa Tramitada
    </Chip>
  ),
  rejected: (
    <Chip variant="flat" color="danger">
      Rechazada
    </Chip>
  ),
  default: <Chip variant="flat">Desconocido</Chip>,
};

export default function EditComparativaPage() {
  const { userData } = useUser();
  const { id } = useParams();
  const [comparativa, setComparativa] = useState<ComparativaVM>();
  const [loading, setLoading] = useState(true);

  const isAdmin = userData?.role === "admin";
  const isBackOffice = userData?.role === "1";

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

      const { success, error, data } = await rs.json();

      if (!success) {
        throw new Error(error);
      }
      console.log("data", data);
      setComparativa(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [id, userData?.id, userData?.role]);

  const handleAddNewNote = async (note: string) => {
    if (!comparativa) return;

    try {
      const rs = await fetch(`/api/comparativas/add/notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: comparativa.notes,
          note,
          id: id,
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

      const notification = generateComparativaUpdatedNotification(
        comparativa.id,
        comparativa.user.id as string,
        true
      );

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner
          label="Cargando..."
          color="primary"
          size="lg"
          className="text-xl"
          variant="gradient"
        />
      </div>
    );
  }

  if (!comparativa) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Comparativa no encontrada.</p>
      </div>
    );
  }

  const getStatusBadge = (status: ComparativaStatus) => {
    return STATUS_BADGES[status] || STATUS_BADGES.default;
  };

  return (
    <div className="mx-12 py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--primary-color-800)]">
            Detalles de Comparativa
          </h1>
          <p className="text-muted-foreground">ID: {comparativa.id}</p>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(comparativa.status)}
          {comparativa.status !== "completed" ? (
            <UpdateComparativaStatusModal
              comparativa={comparativa}
              onUpdate={fetchComparativa}
            />
          ) : (
            <ComparativaToTramite
              comparativa={comparativa}
              onComparativaUpdated={fetchComparativa}
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Info Card */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl text-[var(--primary-color-800)]">
                  {comparativa.client}
                </CardTitle>
                <CardDescription className="flex items-center gap-1 mt-1">
                  <ServiceInfo
                    service={comparativa.service}
                    tramiteId={comparativa.tramite_id}
                  />
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="notes">
              <TabsList
                className={`grid mb-4 ${
                  isAdmin || isBackOffice ? "grid-cols-2" : "grid-cols-1"
                }`}
              >
                <TabsTrigger
                  value="notes"
                  className="!text-[var(--primary-color-800)]"
                >
                  Notas - {comparativa.notes.length}
                </TabsTrigger>
                {(isAdmin || isBackOffice) && (
                  <TabsTrigger
                    value="commissions"
                    className="!text-[var(--primary-color-800)]"
                  >
                    Comisiones
                  </TabsTrigger>
                )}
              </TabsList>

              {(isAdmin || isBackOffice) && (
                <TabsContent value="commissions" className="space-y-4">
                  <CommissionsTabContent
                    comparativa={comparativa}
                    userData={userData as User}
                  />
                  <UpdateComissionsModal
                    onUpdate={fetchComparativa}
                    comparativa={comparativa}
                  />
                </TabsContent>
              )}

              <TabsContent value="notes">
                <NotesSection
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
            <CardTitle className="text-[var(--primary-color-800)]">
              Información Adicional
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* User Info */}
            <div className="space-y-3">
              <h3 className="font-light flex items-center gap-2 text-[var(--primary-color-800)]">
                <LucideUser className="h-4 w-4" />
                <span>Creado por</span>
              </h3>

              <div className="flex items-center gap-3">
                <AvatarComponent
                  userData={comparativa.user as User}
                  className="!rounded-full"
                />
                <div>
                  <p className="font-medium">{comparativa.user.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {comparativa.user.email}
                  </p>
                </div>
              </div>
            </div>

            <Divider />

            {/* Date Info */}
            <div className="space-y-3">
              <h3 className="font-light flex items-center gap-2 text-[var(--primary-color-800)]">
                <Calendar className="h-4 w-4" />
                <span>Fecha de Creación</span>
              </h3>
              <p>{formatDateTime(comparativa.creation_date)}</p>
            </div>

            <Divider />

            {/* Status Info */}
            <div className="space-y-3">
              <h3 className="font-light flex items-center gap-2 text-[var(--primary-color-800)]">
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
          <CardTitle className="text-[var(--primary-color-800)]">
            Archivos Adjuntos
          </CardTitle>
          <CardDescription>
            {comparativa.files.length} archivo
            {comparativa.files.length !== 1 ? "s" : ""} adjunto
            {comparativa.files.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FilesList
            files={(comparativa.files as ComparativaFile[]) || []}
            comparativaId={comparativa.id}
            organization_id={userData?.organization.id as string}
          />
        </CardContent>
        <CardFooter>
          <UploadComparativaFilesModal
            onUpload={fetchComparativa}
            status={comparativa.status}
            userData={userData as User}
            comparativa={comparativa}
          />
        </CardFooter>
      </Card>
    </div>
  );
}
