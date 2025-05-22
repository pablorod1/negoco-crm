"use client";
import { CloudAlert, Search } from "lucide-react";
import { Input } from "../ui/input";
import { ClientCard } from "./ClientCard";
import { ClientDB } from "@/lib/core/types";
import { useEffect, useState } from "react";
import { useUser } from "@/lib/contexts/UserContext";
import { showCustomToast } from "../core/CustomToast";
import LoadingStateCard from "../dashboard/LoadingStateCard";

export interface ClientListItem extends ClientDB {
  tramites_count: number;
  files_count: number;
}

export default function ClientsList() {
  const { userData } = useUser();
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchClients = async () => {
      if (!userData) return;
      try {
        const response = await fetch(`/api/clients/get/all`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id: userData.id, role: userData.role }),
        });

        const { success, data, error } = await response.json();

        if (!success) {
          showCustomToast({
            title: "Error",
            message: error,
            icon: CloudAlert,
            iconSize: 24,
            iconColor: "var(--danger-color)",
          });
          return;
        }

        if (data && data.length > 0) {
          setClients(data);
        } else {
          showCustomToast({
            title: "Sin clientes",
            message: "No se encontraron clientes.",
            icon: CloudAlert,
            iconSize: 24,
            iconColor: "var(--warning-color)",
          });
          setClients([]);
          return;
        }
      } catch (error) {
        console.error("Error fetching clients:", error);
        showCustomToast({
          title: "Error",
          message: "Error al cargar los clientes.",
          icon: CloudAlert,
          iconSize: 24,
          iconColor: "var(--danger-color)",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchClients();
  }, [userData]);
  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between px-4">
        <h1 className="text-4xl font-extrabold text-primary-600 drop-shadow-sm tracking-tight">
          Gestión de Clientes
        </h1>
      </div>
      <div className="mb-8 flex items-center gap-2 px-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar clientes..."
            className="w-full bg-background pl-8 shadow-none md:w-2/3 lg:w-1/3 rounded-lg border border-gray-200"
          />
        </div>
      </div>
      <div className="px-2 md:px-0">
        {loading ? (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(4)].map((_, index) => (
              <LoadingStateCard key={index} />
            ))}
          </div>
        ) : clients.length > 0 ? (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {clients.map((client) => (
              <ClientCard key={client.id} client={client} />
            ))}
          </div>
        ) : (
          <div className="mt-12 flex flex-col items-center justify-center rounded-lg p-12 text-center bg-white/80 shadow-inner">
            <div className="rounded-full bg-gray-100 p-3">
              <CloudAlert className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="mt-4 text-2xl font-semibold text-gray-700">
              No hay clientes registrados
            </h3>
            <p className="mt-2 text-base text-muted-foreground max-w-md">
              No se encontraron clientes en el sistema. Contacte al
              administrador si necesita registrar un nuevo cliente.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
