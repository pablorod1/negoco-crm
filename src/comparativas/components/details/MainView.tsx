import { useEffect, useState } from "react";
import { ComparativaVM, ComparativaFile } from "@/comparativas/types";
import { User, UserDefaultNote } from "@/core/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Switch } from "@/core/components/ui/switch";
import { ServiceInfo } from "@/comparativas/components/editComparativa/ServiceInfo";
import { formatDateTime } from "@/core/utils/format";
import AvatarComponent from "@/core/components/AvatarComponent";
import { getStatusBadge } from "@/core/hooks/use-status-badge";
import {
  User as UserIcon,
  Info,
  ClipboardList,
  FileText,
  XCircle,
  ShieldCheck,
  RefreshCw,
  Zap,
  AlertTriangle,
  Clock,
} from "lucide-react";
import UpdateComparativaStatusModal from "@/comparativas/components/editComparativa/UpdateComparativaStatusModal";
import CompletarEstudioModal from "@/comparativas/components/editComparativa/CompletarEstudioModal";
import AddTramiteDialog from "@/tramites/components/createTramite/AddTramiteDialog";
import TooltipComponent from "@/core/components/TooltipComponent";
import { Link } from "next-view-transitions";
import { FilesList } from "@/comparativas/components/editComparativa/FilesList";
import UploadComparativaFilesModal from "@/comparativas/components/editComparativa/UploadComparativaFilesModal";
import ComparativaComissionsSection from "@/comparativas/components/editComparativa/ComparativaComissionsSection";
import ComparativaPlanSection from "@/comparativas/components/editComparativa/ComparativaPlanSection";
import { useEnergySupplierById } from "@/comercializadoras/hooks/useEnergySupplierById";
import { useSidebarSlideNavigation } from "@/core/view-transitions/useGenieEffect";
import { AbarcaPanel } from "@/comparativas/components/details/AbarcaPanel";
import { showCustomToast } from "@/core/components/CustomToast";
import { hasPermission } from "@/core/access-control/client";
import { hasAiStudiesCapability } from "@/core/access-control/capabilities";
import { PredefinedNote } from "@/core/components/PredefinedNote";

interface MainViewProps {
  comparativa: ComparativaVM;
  userData: User;
  onUpdate: () => void;
  isSubcomercial: boolean;
  isEditable: boolean;
  isComercialEditable: boolean;
  isProcessed: boolean;
}

const PERIODS = ["P1", "P2", "P3", "P4", "P5", "P6"] as const;
const ABARCA_POWER_FIELDS = [
  "potencia_contratada",
  "potencia_contratada_p2",
  "potencia_contratada_p3",
  "potencia_contratada_p4",
  "potencia_contratada_p5",
  "potencia_contratada_p6",
] as const;
const ABARCA_CONSUMPTION_FIELDS = [
  "consumo_p1",
  "consumo_p2",
  "consumo_p3",
  "consumo_p4",
  "consumo_p5",
  "consumo_p6",
] as const;
const NUMBER_FORMAT = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 2,
});

export default function MainView({
  comparativa,
  userData,
  onUpdate,
  isSubcomercial,
  isEditable,
  isComercialEditable,
  isProcessed,
}: MainViewProps) {
  const isComercial = userData.role === "2";
  const isStudied = comparativa.status === "completed";
  const isAwaitingReview = comparativa.status === "awaiting_review";
  const isPendingStudy =
    comparativa.status === "pending" || comparativa.status === "processing";
  const canMarkAsProcessing =
    comparativa.status === "pending" &&
    (userData.role === "admin" || userData.role === "1");
  const canCompleteStudies = hasPermission(
    userData.permissions,
    userData.role,
    "comparisons.study.complete",
  );
  const canReviewStudies = hasPermission(
    userData.permissions,
    userData.role,
    "comparisons.study.review",
  );
  const canUseAiStudies =
    canCompleteStudies &&
    (isComercial
      ? userData.has_abarca_user_id
      : hasAiStudiesCapability(userData.organization.abarca_user_id));
  const assignedCommercialId = comparativa.user.id;
  const canEditCommercialSummary =
    (userData.role === "admin" || userData.role === "1") && isStudied;
  const hasPrioritySummary = !isSubcomercial || isStudied;
  const abarcaEstudio = comparativa.abarca_estudio;
  const contractedPowers = abarcaEstudio
    ? PERIODS.map((period, index) => ({
      period,
      value: abarcaEstudio[ABARCA_POWER_FIELDS[index]],
    }))
    : [];
  const abarcaConsumption = abarcaEstudio
    ? PERIODS.map((period, index) => ({
      period,
      value: abarcaEstudio[ABARCA_CONSUMPTION_FIELDS[index]],
    }))
    : [];
  const totalAbarcaConsumption = getNullableTotal(
    abarcaConsumption.map((item) => item.value),
  );
  const apoloDemandPower = abarcaEstudio?.apolo_sips
    ? PERIODS.map((period) => ({
      period,
      value:
        abarcaEstudio.apolo_sips?.max_demand_power_kw_by_period[period] ??
        null,
    }))
    : [];
  const maxApoloDemandPower = getNullableTotal(
    apoloDemandPower.length
      ? [Math.max(...apoloDemandPower.map((item) => item.value ?? 0))]
      : [],
  );

  // Fetch supplier information if company_id is available
  const { supplier, loading: isLoadingSupplier } = useEnergySupplierById(
    comparativa.company_id,
  );

  const handleSidebarClick = useSidebarSlideNavigation();

  const [rechazando, setRechazando] = useState(false);
  const [markingAsProcessing, setMarkingAsProcessing] = useState(false);
  const [updatingFlag, setUpdatingFlag] = useState<
    "has_permanencia" | "has_renovacion" | null
  >(null);
  const [predefinedNotes, setPredefinedNotes] = useState<UserDefaultNote[]>([]);
  const [isLoadingPredefinedNotes, setIsLoadingPredefinedNotes] =
    useState(false);
  const visiblePredefinedNotes = assignedCommercialId ? predefinedNotes : [];
  const visibleIsLoadingPredefinedNotes = assignedCommercialId
    ? isLoadingPredefinedNotes
    : false;

  useEffect(() => {
    if (!assignedCommercialId) {
      return;
    }

    const controller = new AbortController();

    const loadPredefinedNotes = async () => {
      setIsLoadingPredefinedNotes(true);

      try {
        const res = await fetch(`/api/v2/users/${assignedCommercialId}`, {
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error("No se pudieron obtener las notas predefinidas");
        }

        const data = (await res.json()) as {
          success?: boolean;
          data?: { targeted_notes?: UserDefaultNote[] };
        };

        const notes = data.success ? data.data?.targeted_notes ?? [] : [];
        setPredefinedNotes(
          notes.filter(
            (note) =>
              note.target === "global" || note.target === "comparativas",
          ),
        );
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setPredefinedNotes([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingPredefinedNotes(false);
        }
      }
    };

    loadPredefinedNotes();

    return () => controller.abort();
  }, [assignedCommercialId]);

  const handleFlagChange = async (
    field: "has_permanencia" | "has_renovacion",
    value: boolean,
  ) => {
    setUpdatingFlag(field);
    try {
      const res = await fetch(`/api/v2/comparisons/${comparativa.id}/flags`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });

      if (res.ok) {
        onUpdate();
        return;
      }

      showCustomToast({
        title: "Error",
        message: "No se pudo actualizar la opción de la comparativa",
        icon: AlertTriangle,
        iconColor: "var(--danger-color)",
      });
    } catch {
      showCustomToast({
        title: "Error",
        message: "Error de conexión al actualizar la opción",
        icon: AlertTriangle,
        iconColor: "var(--danger-color)",
      });
    } finally {
      setUpdatingFlag(null);
    }
  };

  const handleRechazarCliente = async () => {
    setRechazando(true);
    try {
      const res = await fetch(
        `/api/v2/comparisons/${comparativa.id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "rechazado_cliente" }),
        },
      );
      const data = await res.json();
      if (data.success) {
        showCustomToast({
          title: "Cliente rechazado",
          message:
            "La comparativa ha sido marcada como rechazada por el cliente",
        });
        onUpdate();
      } else {
        showCustomToast({
          title: "Error",
          message: data.error || "No se pudo rechazar el cliente",
          icon: AlertTriangle,
          iconColor: "var(--danger-color)",
        });
      }
    } catch {
      showCustomToast({
        title: "Error",
        message: "Error de conexión",
        icon: AlertTriangle,
        iconColor: "var(--danger-color)",
      });
    } finally {
      setRechazando(false);
    }
  };

  const handleMarkAsProcessing = async () => {
    setMarkingAsProcessing(true);
    try {
      const res = await fetch(
        `/api/v2/comparisons/${comparativa.id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "processing" }),
        },
      );

      if (!res.ok) {
        showCustomToast({
          title: "Error",
          message: "No se pudo marcar la comparativa como procesando",
          icon: AlertTriangle,
          iconColor: "var(--danger-color)",
        });
        return;
      }

      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!data.success) {
        showCustomToast({
          title: "Error",
          message: data.error ?? "No se pudo actualizar el estado",
          icon: AlertTriangle,
          iconColor: "var(--danger-color)",
        });
        return;
      }

      showCustomToast({
        title: "Comparativa en proceso",
        message: "La comparativa ha sido marcada como Procesando",
      });
      onUpdate();
    } catch {
      showCustomToast({
        title: "Error",
        message: "Error de conexión al actualizar el estado",
        icon: AlertTriangle,
        iconColor: "var(--danger-color)",
      });
    } finally {
      setMarkingAsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(280px,0.85fr)_minmax(0,2.15fr)]">
        {/* Card 1: Acciones */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Info className="h-4 w-4" />
              Acciones
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Acciones disponibles */}
            <div className="space-y-3">
              <div className="border-b border-gray-200 pb-4">
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                  Resto de información
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <p className="mb-1 text-xs text-gray-500">Estado</p>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(comparativa.status, "comparativa")}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-gray-500">Servicio</p>
                    <ServiceInfo service={comparativa.service} size="sm" />
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-gray-500">Comercializadora</p>
                    <p className="text-sm font-medium text-gray-900">
                      {comparativa.company_id
                        ? supplier?.name ??
                        (isLoadingSupplier ? "Cargando" : "—")
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-gray-500">
                      Fecha de creación
                    </p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatDateTime(comparativa.creation_date)}
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                Acciones disponibles
              </p>

              <div className="space-y-2">
                {/* Comparativa procesada — Ver trámite */}
                {comparativa.status === "processed" &&
                  comparativa.tramite_id && (
                    <TooltipComponent content="Ver el trámite generado desde esta comparativa">
                      <Link
                        onClick={handleSidebarClick}
                        href={`/tramites/${comparativa.tramite_id}`}
                        className="flex items-center gap-3 p-3 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors group"
                      >
                        <div className="p-1.5 rounded-md bg-blue-100 group-hover:bg-blue-200 transition-colors">
                          <ClipboardList className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-blue-900">
                            Ver Trámite Asociado
                          </p>
                          <p className="text-xs text-blue-600">
                            Comparativa convertida exitosamente
                          </p>
                        </div>
                      </Link>
                    </TooltipComponent>
                  )}

                {/* Comparativa pendiente o en proceso */}
                {isPendingStudy ? (
                  <div className="space-y-3">
                    {canMarkAsProcessing ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={handleMarkAsProcessing}
                        disabled={markingAsProcessing}
                      >
                        <RefreshCw
                          className={`size-4 ${markingAsProcessing ? "animate-spin" : ""}`}
                        />
                        {markingAsProcessing
                          ? "Actualizando..."
                          : "Marcar como Procesando"}
                      </Button>
                    ) : null}

                    {canCompleteStudies ? (
                      <div className="space-y-3">
                        {canUseAiStudies ? (
                          <AbarcaPanel
                            comparativaId={comparativa.id}
                            onStudyCompleted={onUpdate}
                            files={comparativa.files}
                          />
                        ) : null}

                        <div className="flex items-center gap-4">
                          <CompletarEstudioModal
                            comparativa={comparativa}
                            onUpdate={onUpdate}
                            userData={userData}
                            canCompleteStudies={canCompleteStudies}
                          />
                        </div>
                      </div>
                    ) : !canMarkAsProcessing ? (
                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                        <p className="text-sm font-medium text-gray-700">
                          No hay acciones disponibles
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          No tienes permiso para completar este estudio.
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {/* Estudio con IA recibido — pendiente de revisión */}
                {isAwaitingReview ? (
                  canReviewStudies ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <div className="mb-3 flex items-center gap-3">
                        <div className="rounded-md bg-amber-100 p-1.5">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-amber-900">
                            Estudio con IA recibido
                          </p>
                          <p className="text-xs text-amber-700">
                            Asigna la comercializadora y las comisiones para
                            continuar
                          </p>
                        </div>
                      </div>
                      <CompletarEstudioModal
                        comparativa={comparativa}
                        onUpdate={onUpdate}
                        userData={userData}
                        mode="ai_review"
                        canCompleteStudies={canCompleteStudies}
                        canReviewStudies={canReviewStudies}
                      />
                    </div>
                  ) : (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                      <div className="flex items-center gap-3">
                        <div className="rounded-md bg-blue-100 p-1.5">
                          <Clock className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-blue-900">
                            Estudio en revisión
                          </p>
                          <p className="text-xs text-blue-700">
                            Dirección o un usuario autorizado completará la
                            revisión.
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                ) : null}

                {/* Comparativa completada — Crear trámite o rechazar */}
                {isStudied && (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <AddTramiteDialog
                      variant="default"
                      comparativa={comparativa}
                      onComparativaUpdated={onUpdate}
                    />
                    <Button
                      type="button"
                      variant="destructiveOutline"
                      size="sm"
                      onClick={handleRechazarCliente}
                      disabled={rechazando}
                      aria-label="Rechazar Cliente: marcar como rechazado por cliente"
                    >
                      <XCircle className="size-4" />
                      {rechazando ? "Rechazando..." : "Rechazar Cliente"}
                    </Button>
                  </div>
                )}

                {/* Otros estados — Modal genérico */}
                {comparativa.status !== "completed" &&
                  comparativa.status !== "processed" &&
                  comparativa.status !== "pending" &&
                  comparativa.status !== "processing" &&
                  comparativa.status !== "awaiting_review" &&
                  !isComercial && (
                    <div className="p-3 rounded-lg border border-gray-200 bg-gray-50">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-1.5 rounded-md bg-gray-100">
                          <Info className="h-4 w-4 text-gray-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            Actualizar Estado
                          </p>
                          <p className="text-xs text-gray-600">
                            Cambiar estado de la comparativa
                          </p>
                        </div>
                      </div>
                      <UpdateComparativaStatusModal
                        comparativa={comparativa}
                        onUpdate={onUpdate}
                        userData={userData}
                      />
                    </div>
                  )}

                {/* Sin acciones disponibles */}
                {isComercial &&
                  comparativa.status !== "completed" &&
                  comparativa.status !== "pending" &&
                  comparativa.status !== "processing" &&
                  comparativa.status !== "awaiting_review" &&
                  comparativa.status !== "processed" && (
                    <div className="p-3 rounded-lg border border-gray-200 bg-gray-50 text-center">
                      <p className="text-sm text-gray-500">
                        No hay acciones disponibles
                      </p>
                      <p className="text-xs text-gray-400">
                        {comparativa.status === "rejected"
                          ? "Comparativa rechazada"
                          : "Esperando respuesta del backoffice"}
                      </p>
                    </div>
                  )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Resumen comercial e información general */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <UserIcon className="h-4 w-4" />
              Resumen comercial
            </CardTitle>
            <CardDescription className="text-gray-500">
              Comisiones, condiciones e información principal de la comparativa
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ComparativaPlanSection
              comparativa={comparativa}
              onUpdate={onUpdate}
              canEdit={canEditCommercialSummary}
            />

            <div
              className={
                hasPrioritySummary
                  ? "grid grid-cols-1 gap-6 xl:grid-cols-[minmax(260px,0.95fr)_minmax(0,1.05fr)]"
                  : "grid grid-cols-1 gap-6"
              }
            >
              {hasPrioritySummary ? (
                <div className="space-y-5">
                  {!isSubcomercial ? (
                    <ComparativaComissionsSection
                      userData={userData}
                      comparativa={comparativa}
                      onUpdate={onUpdate}
                      canEdit={canEditCommercialSummary}
                      embedded
                    />
                  ) : null}

                  {isStudied && (
                    <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-4">
                      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                        Renovación y permanencia
                      </p>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="flex items-center justify-between gap-4 rounded-lg bg-white p-3 shadow-sm ring-1 ring-gray-100">
                          <label
                            htmlFor={`permanencia-${comparativa.id}`}
                            className="flex min-w-0 items-center gap-2 text-xs font-medium text-gray-700"
                          >
                            <ShieldCheck className="size-3.5 shrink-0 text-gray-500" />
                            <span>Permanencia</span>
                          </label>
                          <Switch
                            id={`permanencia-${comparativa.id}`}
                            checked={!!comparativa.has_permanencia}
                            disabled={updatingFlag !== null || isComercial}
                            aria-label="Marcar comparativa con permanencia"
                            onCheckedChange={(checked) =>
                              handleFlagChange("has_permanencia", checked)
                            }
                            className="data-[state=checked]:bg-green-600"
                          />
                        </div>

                        <div className="flex items-center justify-between gap-4 rounded-lg bg-white p-3 shadow-sm ring-1 ring-gray-100">
                          <label
                            htmlFor={`renovacion-${comparativa.id}`}
                            className="flex min-w-0 items-center gap-2 text-xs font-medium text-gray-700"
                          >
                            <RefreshCw className="size-3.5 shrink-0 text-gray-500" />
                            <span>Renovación</span>
                          </label>
                          <Switch
                            id={`renovacion-${comparativa.id}`}
                            checked={!!comparativa.has_renovacion}
                            disabled={updatingFlag !== null || isComercial}
                            aria-label="Marcar comparativa con renovación"
                            onCheckedChange={(checked) =>
                              handleFlagChange("has_renovacion", checked)
                            }
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              <div className="space-y-5">
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                    Comercial asignado
                  </p>
                  <div className="flex items-start gap-3">
                    <AvatarComponent
                      userData={comparativa.user as User}
                      className="rounded-full! h-9 w-9"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-900">
                        {comparativa.user.name || "Sin asignar"}
                      </p>
                      <p className="truncate text-xs text-gray-500">
                        {comparativa.user.email || "Sin email"}
                      </p>
                    </div>
                  </div>

                  {!isComercial ? <div className="mt-4 border-t border-gray-100 pt-4">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                      Notas predefinidas
                    </p>
                    {visibleIsLoadingPredefinedNotes ? (
                      <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-500">
                        Cargando notas predefinidas&hellip;
                      </p>
                    ) : visiblePredefinedNotes.length > 0 ? (
                      <div className="space-y-2">
                        {visiblePredefinedNotes.map((note) => (
                          <PredefinedNote key={note.id} note={note} />
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-500">
                        Sin notas predefinidas para comparativas.
                      </p>
                    )}
                  </div> : null}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Estudio con IA */}
      {abarcaEstudio && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              Datos del estudio con IA
            </CardTitle>
            <CardDescription className="text-gray-500 hidden">
              Datos recibidos del comparador energético
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Titular */}
              <div className="space-y-6">
                <div className="space-y-3">
                  <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">
                    Titular
                  </p>
                  <div className="grid grid-cols-2 gap-4 gap-y-8">
                    <div>
                      <p className="text-xs text-gray-500">Nombre completo</p>
                      <p className="text-sm font-medium text-gray-900">
                        {abarcaEstudio.nombre_completo || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">DNI / NIF</p>
                      <p className="text-sm font-medium text-gray-900">
                        {abarcaEstudio.dni || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Email</p>
                      <p className="text-sm font-medium text-gray-900">
                        {abarcaEstudio.email || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Teléfono</p>
                      <p className="text-sm font-medium text-gray-900">
                        {abarcaEstudio.movil || "—"}
                      </p>
                    </div>
                  </div>
                </div>
                {/* Dirección y Contacto */}
                <div className="space-y-3">
                  <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">
                    Dirección del suministro
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Dirección</p>
                      <p className="text-sm font-medium text-gray-900">
                        {[
                          abarcaEstudio.calle_cups,
                          abarcaEstudio.numero_cups,
                        ]
                          .filter(Boolean)
                          .join(" ") || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Localidad</p>
                      <p className="text-sm font-medium text-gray-900">
                        {abarcaEstudio.localidad_cups || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Código Postal</p>
                      <p className="text-sm font-medium text-gray-900">
                        {abarcaEstudio.codpostal_cups || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">IBAN</p>
                      <p className="text-sm font-medium text-gray-900">
                        {abarcaEstudio.iban || "—"}
                      </p>
                    </div>
                    {abarcaEstudio.observaciones && (
                      <div>
                        <p className="text-xs text-gray-500">Observaciones</p>
                        <p className="text-sm text-gray-700">
                          {abarcaEstudio.observaciones}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Suministro */}
              <div className="space-y-3">
                <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">
                  Suministro
                </p>
                <div className="grid grid-cols-2 gap-4 gap-y-8">
                  <div>
                    <p className="text-xs text-gray-500">CUPS</p>
                    <p className="text-sm font-medium text-gray-900 break-all">
                      {abarcaEstudio.cups}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Tarifa</p>
                    <p className="text-sm font-medium text-gray-900">
                      {abarcaEstudio.tipo_tarifa || "—"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-start gap-4 col-span-2">
                    {contractedPowers.map(({ period, value }) => (
                      <div key={period}>
                        <p className="text-xs text-gray-500">
                          Potencia {period}
                        </p>
                        <p className="text-sm font-medium text-gray-900">
                          {formatNullableUnit(value, "kW")}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-start gap-4 col-span-2">
                    {abarcaConsumption.map(({ period, value }) => (
                      <div key={period}>
                        <p className="text-xs text-gray-500">
                          Consumo {period}
                        </p>
                        <p className="text-sm font-medium text-gray-900">
                          {formatNullableUnit(value, "kWh")}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Consumo total</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatNullableUnit(totalAbarcaConsumption, "kWh")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Compañía actual</p>
                    <p className="text-sm font-medium text-gray-900">
                      {abarcaEstudio.empresa_cliente || "—"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Potencia Demandada SIPS */}
              {abarcaEstudio.apolo_sips && (
                <div className="space-y-3">
                  <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">
                    Potencia máxima demandada (SIPS)
                  </p>
                  <div className="grid grid-cols-2 gap-4 gap-y-8">
                    {apoloDemandPower.map(({ period, value }) => (
                      <div key={period}>
                        <p className="text-xs text-gray-500">
                          Potencia {period}
                        </p>
                        <p className="text-sm font-medium text-gray-900">
                          {formatNullableUnit(value, "kW")}
                        </p>
                      </div>
                    ))}
                    <div>
                      <p className="text-xs text-gray-500">Máximo registrado</p>
                      <p className="text-sm font-medium text-gray-900">
                        {formatNullableUnit(maxApoloDemandPower, "kW")}
                      </p>
                    </div>
                  </div>
                </div>
              )}

            </div>

          </CardContent>
        </Card>
      )}



      {/* Documentos Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-gray-900 flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Documentos
          </CardTitle>
          <CardDescription className="text-gray-500">
            {comparativa.files.length} archivo
            {comparativa.files.length !== 1 ? "s" : ""} adjunto
            {comparativa.files.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FilesList
            files={(comparativa.files as ComparativaFile[]) || []}
            comparativa_id={comparativa.id}
            organization_id={userData.organization.id}
            onDeleted={onUpdate}
            isComercial={isComercial}
            isProcessed={isProcessed}
            userId={userData.id}
          />
        </CardContent>
        <CardFooter>
          {(isEditable || isComercialEditable) && (
            <UploadComparativaFilesModal
              onUpload={onUpdate}
              userData={userData}
              comparativa={comparativa}
            />
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

function getNullableTotal(values: Array<number | null>): number | null {
  if (!values.some((value) => value !== null)) return null;
  return values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

function formatNullableUnit(
  value: number | null | undefined,
  unit: "kW" | "kWh",
): string {
  if (value === null || value === undefined) return "—";
  return `${NUMBER_FORMAT.format(value)} ${unit}`;
}
