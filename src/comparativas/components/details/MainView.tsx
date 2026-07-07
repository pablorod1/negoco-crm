import { ComparativaVM, ComparativaFile } from "@/comparativas/types";
import { User } from "@/core/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/core/components/ui/card";
import { ServiceInfo } from "@/comparativas/components/editComparativa/ServiceInfo";
import { formatDateTime } from "@/core/utils/format";
import AvatarComponent from "@/core/components/AvatarComponent";
import { getStatusBadge } from "@/core/hooks/use-status-badge";
import {
  User as UserIcon,
  Info,
  ClipboardList,
  FileText,
  CheckCircle,
  Zap,
  AlertTriangle,
  Clock,
  Gauge,
} from "lucide-react";
import UpdateComparativaStatusModal from "@/comparativas/components/editComparativa/UpdateComparativaStatusModal";
import CompletarEstudioModal from "@/comparativas/components/editComparativa/CompletarEstudioModal";
import AddTramiteDialog from "@/tramites/components/createTramite/AddTramiteDialog";
import TooltipComponent from "@/core/components/TooltipComponent";
import { Link } from "next-view-transitions";
import { FilesList } from "@/comparativas/components/editComparativa/FilesList";
import UploadComparativaFilesModal from "@/comparativas/components/editComparativa/UploadComparativaFilesModal";
import ComparativaComissionsSection from "@/comparativas/components/editComparativa/ComparativaComissionsSection";
import { cn } from "@/core/utils";
import { useEnergySupplierById } from "@/comercializadoras/hooks/useEnergySupplierById";
import { useSidebarSlideNavigation } from "@/core/view-transitions/useGenieEffect";
import { AbarcaPanel } from "@/comparativas/components/details/AbarcaPanel";

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
  const isAdmin = userData.role === "admin" || userData.role === "1";
  // Los admins pueden editar comisiones cuando la comparativa está estudiada
  const canEditComissions = isAdmin && isStudied;
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

  return (
    <div className="space-y-6">
      {/* Hero Section - 3 Cards */}
      <div
        className={cn(
          "grid grid-cols-1  gap-6",
          isSubcomercial ? "lg:grid-cols-2" : "lg:grid-cols-3",
        )}
      >
        {/* Card 1: Estado y Acciones */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Info className="h-4 w-4" />
              Estado y Acciones
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Estado actual */}
            <div className="space-y-2">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                Estado actual
              </p>
              <div className="flex items-center gap-2">
                {getStatusBadge(comparativa.status, "comparativa")}
              </div>
            </div>

            {/* Separador visual */}
            <div className="border-t border-gray-100"></div>

            {/* Acciones disponibles */}
            <div className="space-y-3">
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

                {/* Comparativa pendiente */}
                {comparativa.status === "pending" && !isComercial ? (
                  <div className="space-y-2">
                    {/* Primary: Comparador IA (cuando disponible) */}
                    {userData.organization.abarca_user_id && (
                      <div className="p-3 rounded-lg border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="p-1.5 rounded-md bg-primary/10">
                            <Zap className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              Acción recomendada
                            </p>
                            <p className="text-xs text-gray-500">
                              Realiza el estudio con el comparador energético
                            </p>
                          </div>
                        </div>
                        <AbarcaPanel
                          comparativaId={comparativa.id}
                          abarcaUserId={userData.organization.abarca_user_id}
                          onStudyCompleted={onUpdate}
                          files={comparativa.files}
                        />
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <CompletarEstudioModal
                        comparativa={comparativa}
                        onUpdate={onUpdate}
                        userData={userData}
                      />
                    </div>
                  </div>
                ) : null}

                {/* Estudio de Abarca recibido — pendiente de revisión */}
                {isAwaitingReview && !isComercial && (
                  <div className="p-3 rounded-lg border border-amber-200 bg-amber-50">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-1.5 rounded-md bg-amber-100">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-amber-900">
                          Estudio Abarca Recibido
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
                      mode="abarca"
                    />
                  </div>
                )}

                {/* Comparativa completada — Crear trámite */}
                {isStudied && (
                  <div className="p-3 rounded-lg border border-green-200 bg-green-50">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-1.5 rounded-md bg-green-100">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-green-900">
                          Estudio Completado
                        </p>
                        <p className="text-xs text-green-600">
                          Listo para convertir en trámite
                        </p>
                      </div>
                    </div>
                    <AddTramiteDialog
                      variant="default"
                      comparativa={comparativa}
                      onComparativaUpdated={onUpdate}
                    />
                  </div>
                )}

                {/* Otros estados — Modal genérico */}
                {comparativa.status !== "completed" &&
                  comparativa.status !== "processed" &&
                  comparativa.status !== "pending" &&
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

                {/* Comercial: estudio en revisión */}
                {isAwaitingReview && isComercial && (
                  <div className="p-3 rounded-lg border border-amber-200 bg-amber-50">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded-md bg-amber-100">
                        <Clock className="h-4 w-4 text-amber-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-amber-900">
                          Estudio en revisión
                        </p>
                        <p className="text-xs text-amber-700">
                          El backoffice está revisando el estudio. La conversión
                          a trámite estará disponible una vez completada la
                          revisión.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sin acciones disponibles */}
                {(comparativa.status === "rejected" ||
                  (isComercial &&
                    comparativa.status !== "completed" &&
                    comparativa.status !== "awaiting_review" &&
                    !(
                      comparativa.status === "pending" &&
                      userData.organization.abarca_user_id
                    ))) && (
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

        {/* Card 2: Comisiones */}
        {!isSubcomercial ? (
          <ComparativaComissionsSection
            userData={userData}
            comparativa={comparativa}
            onUpdate={onUpdate}
            canEdit={canEditComissions}
          />
        ) : null}

        {/* Card 3: Información General */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <UserIcon className="h-4 w-4" />
              Información General
            </CardTitle>
          </CardHeader>
          <CardContent className=" relative overflow-hidden">
            <div className="grid grid-cols-2 gap-6 space-x-12 gap-x-16">
              <div>
                <p className="text-xs text-gray-500 mb-1">Servicio</p>
                <ServiceInfo service={comparativa.service} size="sm" />
              </div>
              {/* Supplier information section */}
              {comparativa.company_id && supplier ? (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Comercializadora</p>
                  <p className="text-sm font-medium text-gray-900">
                    {supplier.name}
                  </p>
                  <div className="flex items-center gap-2">
                    {isLoadingSupplier ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-gray-200 rounded animate-pulse"></div>
                        <span className="text-sm text-gray-500">
                          Cargando...
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div></div>
              )}
              <div className="flex flex-col gap-6">
                <div>
                  <p className="text-xs text-gray-500 mb-1">
                    Fecha de Creación
                  </p>
                  <p className="text-sm font-medium text-gray-900">
                    {formatDateTime(comparativa.creation_date)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Creado por</p>
                  <div className="flex items-center gap-2">
                    <AvatarComponent
                      userData={comparativa.user as User}
                      className="!rounded-full w-6 h-6"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {comparativa.user.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {comparativa.user.email}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between"></div>
          </CardContent>
        </Card>
      </div>

      {/* Estudio Abarca Section */}
      {abarcaEstudio && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              Estudio Negoco Cloud IA
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

              {/* Potencia Demandada APOLO */}
              {abarcaEstudio.apolo_sips && (
                <div className="space-y-3">
                  <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">
                    Potencia máxima demandada (Apolo SIPS)
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

      {abarcaEstudio?.apolo_sips && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Gauge className="h-4 w-4 text-primary-600" />
              Potencia máxima demandada
            </CardTitle>
            <CardDescription className="text-gray-500">
              Datos de Apolo SIPS para los últimos{" "}
              {abarcaEstudio.apolo_sips.months} meses disponibles
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-col gap-2 rounded-xl border border-primary-100 bg-primary-50/40 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs text-gray-500">CUPS consultado</p>
                <p className="font-mono text-sm font-semibold text-gray-900">
                  {abarcaEstudio.apolo_sips.cups}
                </p>
              </div>
              <div className="text-left md:text-right">
                <p className="text-xs text-gray-500">Máximo registrado</p>
                <p className="text-lg font-semibold text-gray-900">
                  {formatNullableUnit(maxApoloDemandPower, "kW")}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
              {apoloDemandPower.map(({ period, value }) => (
                <div
                  key={period}
                  className="rounded-lg border border-gray-100 bg-gray-50 p-3"
                >
                  <p className="text-xs font-semibold text-primary-700">
                    {period}
                  </p>
                  <p className="text-sm font-medium text-gray-900">
                    {formatNullableUnit(value, "kW")}
                  </p>
                </div>
              ))}
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
