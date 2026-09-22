"use client";
import { useCallback, useEffect, useState } from "react";
import CreateUserModal from "@/colaboradores/components/CreateUserModal";
import CommissionsPanel from "@/colaboradores/components/CommissionsPanel";
import UsersGridTable from "@/colaboradores/components/UsersGrid";
import UserLimitBar from "@/colaboradores/components/UserLimitBar";
import { User } from "@/core/types";
import { useUser } from "@/core/contexts/UserContext";
import { useUsers } from "@/core/contexts/UsersContext"; // Importar el nuevo contexto
import { showCustomToast } from "@/core/components/CustomToast";
import { useAbarcaSyncStatuses } from "@/core/hooks/use-abarca-sync-statuses";
import { cn } from "@/core/utils";
import { BadgeEuro, CircleX, List } from "lucide-react";

type CollaboratorsView = "list" | "commissions";

export default function ColaboradoresPage() {
  const { userData } = useUser();
  const { setRefreshUsers } = useUsers(); // Usar el contexto de usuarios
  const [state, setState] = useState<{
    users: User[];
    loading: boolean;
    initialized: boolean;
  }>({
    users: [],
    loading: true,
    initialized: false,
  });
  const [canAddUsers, setCanAddUsers] = useState(true);
  const [view, setView] = useState<CollaboratorsView>("list");

  const isAdmin = userData && userData.role === "admin";
  const {
    statuses: syncStatuses,
    issueCount,
    refetch: refetchSyncStatuses,
    verify: verifySyncStatuses,
  } = useAbarcaSyncStatuses(Boolean(isAdmin));

  const fetchData = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }));
    if (!userData) {
      setState((prev) => ({
        ...prev,
        users: [],
        loading: false,
        initialized: true,
      }));
      return;
    }
    try {
      const res = await fetch(
        `/api/v2/users/${userData.id}/all?role=${userData.role}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      const { success, data } = await res.json();
      if (!success) {
        throw new Error("Error al obtener los usuarios");
      }

      const sortUsers = data.sort((a: User, b: User) =>
        a.name.localeCompare(b.name)
      );
      setState({
        users: sortUsers,
        loading: false,
        initialized: true,
      });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        users: [],
        loading: false,
        initialized: true,
      }));
      showCustomToast({
        title: "Error al obtener los usuarios",
        message: error + " Inténtalo de nuevo más tarde",
        icon: CircleX,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
    }
  }, [userData]);

  // Efecto para la carga inicial
  useEffect(() => {
    if (!state.initialized && userData) {
      queueMicrotask(() => void fetchData());
    }
  }, [userData, state.initialized, fetchData]);

  // Registrar la función fetchData con el contexto
  useEffect(() => {
    const cleanup = setRefreshUsers(fetchData);
    return cleanup; // Limpiar al desmontar
  }, [fetchData, setRefreshUsers]);

  const handleUserCreated = useCallback(() => {
    fetchData();
  }, [fetchData]);

  const handleLimitCheck = useCallback((canAdd: boolean) => {
    setCanAddUsers(canAdd);
  }, []);

  // Si no hay userData y no hemos inicializado, mostramos loading
  if (!userData && !state.initialized) {
    return (
      <div className="w-full">
        <div className="border-b border-gray-100 bg-white">
          <div className="container mx-auto px-6 py-6">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold text-gray-900">
                Colaboradores
              </h1>
              <p className="text-sm text-gray-500">
                Gestiona los usuarios y permisos del sistema
              </p>
            </div>
          </div>
        </div>
        <div className="container mx-auto px-6 py-6">
          <UsersGridTable users={[]} loading={true} />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header minimalista con jerarquía clara */}
      <div className="border-b border-gray-100 bg-white">
        <div className="container mx-auto px-6 py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold text-gray-900">
                Colaboradores
              </h1>
              <p className="text-sm text-gray-500">
                {view === "list"
                  ? "Gestiona los usuarios y permisos del sistema"
                  : "Configura las comisiones y su sincronización con el Comparador"}
              </p>
            </div>
            {isAdmin && (
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex rounded-2xl border border-gray-200 bg-gray-50 p-1">
                  <button
                    type="button"
                    onClick={() => setView("list")}
                    className={cn(
                      "flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors",
                      view === "list"
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500 hover:text-gray-900",
                    )}
                  >
                    <List size={16} />
                    Listado
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("commissions")}
                    className={cn(
                      "relative flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors",
                      view === "commissions"
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500 hover:text-gray-900",
                    )}
                  >
                    <BadgeEuro size={16} />
                    Comisiones
                    {issueCount > 0 && (
                      <span className="flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white">
                        {issueCount > 99 ? "99+" : issueCount}
                      </span>
                    )}
                  </button>
                </div>
                {view === "list" && (
                  <CreateUserModal
                    onUserCreated={handleUserCreated}
                    disabled={!canAddUsers}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="container mx-auto px-6 py-6">
        {view === "commissions" && isAdmin ? (
          <CommissionsPanel
            users={state.users}
            statuses={syncStatuses}
            onStatusesChanged={refetchSyncStatuses}
            onStatusesCheck={verifySyncStatuses}
          />
        ) : (
          <>
            {isAdmin && <UserLimitBar onLimitReached={handleLimitCheck} />}
            <UsersGridTable users={state.users} loading={state.loading} />
          </>
        )}
      </div>
    </div>
  );
}
