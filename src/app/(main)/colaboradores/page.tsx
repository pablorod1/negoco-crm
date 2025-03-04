"use client";
import { useCallback, useEffect, useState } from "react";
import CreateUserModal from "@/components/colaboradores/CreateUserModal";
import UsersGridTable from "@/components/colaboradores/UsersGrid";
import { User } from "@/lib/core/types";
import { useUser } from "@/contexts/UserContext";
import { useUsers } from "@/contexts/UsersContext"; // Importar el nuevo contexto
import { showCustomToast } from "@/components/core/CustomToast";
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

  const checkIfAdmin = useCallback(() => {
    if (!userData) {
      return false;
    }

    return userData.role === "admin";
  }, [userData]);

  const fetchData = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }));

    try {
      const res = await fetch(
        `/api/users/get/users${
          userData ? `?role=${userData.role}&id=${userData.id}` : ""
        }`
      );
      const { success, data } = await res.json();

      if (!success) {
        throw new Error("Error al obtener los usuarios");
      }

      setState({
        users: data,
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

  // Si no hay userData y no hemos inicializado, mostramos loading
  if (!userData && !state.initialized) {
    return (
      <div className="container mx-auto py-8">
        <UsersGridTable users={[]} loading={true} />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center gap-4 mb-8 w-full">
        <h1 className="text-4xl font-bold text-[var(--primary-color-500)] drop-shadow-sm">
          Gestión de Colaboradores
        </h1>
        {checkIfAdmin() && (
          <CreateUserModal onUserCreated={handleUserCreated} />
        )}
      </div>
      <UsersGridTable users={state.users} loading={state.loading} />
    </div>
  );
}
