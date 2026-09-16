import { User } from "@/core/types";
import { getStatusBadge } from "@/core/hooks/use-status-badge";
import UpdateTramiteStatusModal from "./UpdateTramiteStatusModal";
import RenewTramiteConfirmationDialog from "../RenewTramiteConfirmationDialog";
import RejectTramiteModal from "./RejectTramiteModal";
import { ClientDB, ContractDB, SignerDB, TramiteVM } from "@/tramites/types";
import { formatDate } from "@/core/utils/format";
import SendToImaginaAction from "./imagina/SendToImaginaAction";
import ImaginaReadinessBar from "./imagina/ImaginaReadinessBar";

interface Props {
  tramite: TramiteVM;
  client: ClientDB;
  contracts: ContractDB[];
  userData: User;
  onUpdate: () => void;
  isEditable: boolean | null;
  isRenewable: boolean;
  onRenew: () => void;
  isActive: boolean;
  showLiquidez?: boolean;
  signer?: SignerDB | null;
}

export default function TramiteStatusSection({
  tramite,
  userData,
  onUpdate,
  isEditable,
  isRenewable,
  onRenew,
  client,
  contracts,
  isActive,
  showLiquidez = false,
  signer,
}: Props) {
  const isAdmin = userData.role === "admin";
  const isBackoffice = userData.role === "1";
  const isComercial = userData.role === "2";
  const isBaja = tramite.status === "Baja";
  // La liquidez solo aporta algo una vez el trámite está activo o de baja.
  const showLiquidezStatus = showLiquidez && (isActive || isBaja);
  const displayLiquidezStatus =
    isComercial && tramite.liquidez_status === "Cobrado por Comercializadora"
      ? "Pendiente de Cobro"
      : isComercial && tramite.liquidez_status === "Adelantado"
        ? "Pagado al Comercial"
        : tramite.liquidez_status;
  const hasActions =
    isEditable ||
    isBaja ||
    (isActive && !isComercial) ||
    (isRenewable && (isAdmin || isBackoffice));
  // Contexto secundario: solo las filas con valor, en un tono discreto.
  // Las fechas llegan tipadas como string pero pueden venir vacías.
  const optionalDate = (date?: string | null) => (date ? formatDate(date) : "");
  const details = [
    { label: "Cliente", value: `${client.name} ${client.last_name}`.trim() },
    { label: "Creación", value: optionalDate(tramite.creation_date) },
    { label: "Tramitación", value: optionalDate(tramite.tramitation_date) },
    { label: "Renovación", value: optionalDate(tramite.renovation_date) },
  ].filter((row) => row.value);

  return (
    <div className="flex h-full flex-col gap-5">
      {/* El estado es lo único que debe leerse de un vistazo */}
      <div className="space-y-2.5">
        <div className="[&>div]:px-3 [&>div]:py-1 [&>div]:text-sm [&_svg]:size-3.5">
          {getStatusBadge(tramite.status, "general")}
        </div>
        {showLiquidezStatus ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Liquidez</span>
            {getStatusBadge(displayLiquidezStatus, "liquidez")}
          </div>
        ) : null}
      </div>

      {details.length > 0 ? (
        <dl className="space-y-1 text-xs">
          {details.map((row) => (
            <div
              key={row.label}
              className="flex items-baseline justify-between gap-3"
            >
              <dt className="shrink-0 text-gray-400">{row.label}</dt>
              <dd className="truncate text-right text-gray-600">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {hasActions ? (
        <div className="space-y-4 border-t border-gray-100 pt-4">
          {isAdmin || isBackoffice ? (
            <ImaginaReadinessBar tramite={tramite} contracts={contracts} />
          ) : null}
          <div className="flex flex-col gap-2 [&>button]:w-full">
            {(isEditable || isBaja) && (
              <UpdateTramiteStatusModal
                tramite={tramite}
                userData={userData}
                onUpdate={onUpdate}
                client={client}
                contracts={contracts}
                signer={signer}
              />
            )}

            {isEditable && (
              <SendToImaginaAction
                tramite={tramite}
                client={client}
                contracts={contracts}
                signer={signer}
                userData={userData}
                onUpdate={onUpdate}
              />
            )}

            {isActive && !isComercial && (
              <RejectTramiteModal
                tramite={tramite}
                userData={userData}
                onSubmit={onUpdate}
              />
            )}

            {isRenewable && (isAdmin || isBackoffice) && (
              <RenewTramiteConfirmationDialog
                tramite={tramite}
                onRenew={onRenew}
                client={client}
              />
            )}
          </div>
        </div>
      ) : (
        <p className="border-t border-gray-100 pt-4 text-xs text-gray-400">
          Sin acciones disponibles
        </p>
      )}
    </div>
  );
}
