import { useEffect, useState } from "react";
import { cn } from "@/core/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/core/components/ui/card";
import {
  ContractDB,
  TramiteVM,
  ClientDB,
} from "@/tramites/types/tramite.types";
import { User, UserDefaultNote } from "@/core/types";
import StatusCard from "./StatusCard";
import ComercialCard from "./ComercialCard";
import FinancialCard from "./FinancialCard";
import ContractSection from "@/tramites/components/editTramite/contract/ContractSection";
import { User as UserIcon } from "lucide-react";

interface MainViewProps {
  tramite: TramiteVM;
  client: ClientDB;
  contracts: ContractDB[];
  userData: User;
  onUpdate: () => void;
  isEditable: boolean | null;
  isComercialEditable: boolean | null;
  isRenewable: boolean;
  isActive: boolean;
  isSubcomercial: boolean;
}

export default function MainView({
  tramite,
  client,
  contracts,
  userData,
  onUpdate,
  isEditable,
  isComercialEditable,
  isRenewable,
  isActive,
  isSubcomercial,
}: MainViewProps) {
  const assignedCommercialId = tramite.user.id || tramite.user_id;
  const showPrioritySummary = !isSubcomercial;
  const [predefinedNotesByUser, setPredefinedNotesByUser] = useState<{
    userId: string;
    notes: UserDefaultNote[];
  } | null>(null);
  const [loadingPredefinedNotesUserId, setLoadingPredefinedNotesUserId] =
    useState<string | null>(null);
  const predefinedNotes =
    predefinedNotesByUser?.userId === assignedCommercialId
      ? predefinedNotesByUser.notes
      : [];
  const isLoadingPredefinedNotes =
    loadingPredefinedNotesUserId === assignedCommercialId;

  useEffect(() => {
    const controller = new AbortController();

    const loadPredefinedNotes = async () => {
      setLoadingPredefinedNotesUserId(assignedCommercialId);

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

        setPredefinedNotesByUser({
          userId: assignedCommercialId,
          notes: notes.filter(
            (note) => note.target === "global" || note.target === "tramites",
          ),
        });
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setPredefinedNotesByUser({ userId: assignedCommercialId, notes: [] });
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingPredefinedNotesUserId(null);
        }
      }
    };

    loadPredefinedNotes();

    return () => controller.abort();
  }, [assignedCommercialId]);

  return (
    <div className="space-y-6">
      {/* Summary Grid */}
      <div
        className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(300px,0.72fr)_minmax(0,2.28fr)]"
      >
        {/* Actions Card */}
        <StatusCard
          tramite={tramite}
          userData={userData}
          onUpdate={onUpdate}
          isEditable={isEditable}
          isRenewable={isRenewable}
          client={client}
          isActive={isActive}
          mode="actions"
        />

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <UserIcon className="size-4" />
              Resumen del trámite
            </CardTitle>
            <CardDescription className="text-gray-500">
              Comisiones, comercial asignado, notas y datos principales
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                "grid grid-cols-1 gap-4",
                showPrioritySummary
                  ? "xl:grid-cols-[minmax(300px,0.9fr)_minmax(360px,1.1fr)]"
                  : "",
              )}
            >
              {showPrioritySummary ? (
                <div className="space-y-4">
                  <FinancialCard
                    tramite={tramite}
                    userData={userData}
                    onUpdate={onUpdate}
                    isEditable={isEditable}
                    embedded
                  />

                  <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Notas predefinidas
                    </p>
                    {isLoadingPredefinedNotes ? (
                      <p className="rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-500">
                        Cargando notas predefinidas&hellip;
                      </p>
                    ) : predefinedNotes.length > 0 ? (
                      <div className="space-y-2">
                        {predefinedNotes.map((note) => (
                          <div
                            key={note.id}
                            className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2"
                          >
                            <p className="text-sm leading-relaxed text-gray-700">
                              {note.note}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-500">
                        Sin notas predefinidas para trámites.
                      </p>
                    )}
                  </div>
                </div>
              ) : null}

              <div className="space-y-4">
                {showPrioritySummary ? (
                  <ComercialCard
                    tramite={tramite}
                    userData={userData}
                    onUpdate={onUpdate}
                    isComercialEditable={isComercialEditable}
                    embedded
                  />
                ) : null}

                {!showPrioritySummary ? (
                  <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Notas predefinidas
                    </p>
                    {isLoadingPredefinedNotes ? (
                      <p className="rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-500">
                        Cargando notas predefinidas&hellip;
                      </p>
                    ) : predefinedNotes.length > 0 ? (
                      <div className="space-y-2">
                        {predefinedNotes.map((note) => (
                          <div
                            key={note.id}
                            className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2"
                          >
                            <p className="text-sm leading-relaxed text-gray-700">
                              {note.note}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-500">
                        Sin notas predefinidas para trámites.
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contract Section */}
      <ContractSection
        contracts={contracts}
        tramite_id={tramite.id}
        onContractUpdated={onUpdate}
        isEditable={isEditable}
        userData={userData}
      />
    </div>
  );
}
