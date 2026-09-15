"use client";
import { useCallback, useEffect, useState } from "react";
import BulkCommissionsModal from "@/colaboradores/components/BulkCommissionsModal";
import CommissionDefaultsModal from "@/colaboradores/components/CommissionDefaultsModal";
import CreateUserModal from "@/colaboradores/components/CreateUserModal";
import UsersGridTable from "@/colaboradores/components/UsersGrid";
import UserLimitBar from "@/colaboradores/components/UserLimitBar";
import { User } from "@/core/types";
import { useUser } from "@/core/contexts/UserContext";
import { useUsers } from "@/core/contexts/UsersContext"; // Importar el nuevo contexto
import { showCustomToast } from "@/core/components/CustomToast";
import { CircleX } from "lucide-react";

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

  const isAdmin = userData && userData.role === "admin";

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
      fetchData();
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
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold text-gray-900">
                Colaboradores
              </h1>
              <p className="text-sm text-gray-500">
                Gestiona los usuarios y permisos del sistema
              </p>
            </div>
            {isAdmin && (
              <div className="flex flex-wrap items-center gap-3">
                <CommissionDefaultsModal />
                <BulkCommissionsModal users={state.users} />
                <CreateUserModal
                  onUserCreated={handleUserCreated}
                  disabled={!canAddUsers}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="container mx-auto px-6 py-6">
        {isAdmin && <UserLimitBar onLimitReached={handleLimitCheck} />}
        <UsersGridTable users={state.users} loading={state.loading} />
      </div>
    </div>
  );
}
