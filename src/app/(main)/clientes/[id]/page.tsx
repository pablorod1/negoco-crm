"use client";
import {
  ArrowLeft,
  ShieldAlertIcon,
  Folder,
  ListFilter,
  Mail,
  MessageCircle,
} from "lucide-react";

import { Badge } from "@/core/components/ui/badge";
import { Button } from "@/core/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/core/components/ui/tooltip";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/core/components/ui/tabs";
import { ClientFilesGrid } from "@/clientes/components/details/ClientFilesGrid";
import { useEffect, useState } from "react";
import { showCustomToast } from "@/core/components/CustomToast";
import { ClientListItem } from "@/clientes/components/ClientsList";
import { Link, useTransitionRouter } from "next-view-transitions";
import { useUser } from "@/core/contexts/UserContext";
import { useParams } from "next/navigation";
import LoadingStateCard from "@/dashboard/components/LoadingStateCard";
import ClientError from "@/clientes/components/details/ClientError";
import ClientContactDetails from "@/clientes/components/details/ClientContactDetails";
import { ClientTramitesTable } from "@/clientes/components/details/ClientTramitesTable";
import AddTramiteDialog from "@/tramites/components/createTramite/AddTramiteDialog";
import ClientRecentlyActivity from "@/clientes/components/details/ClientRecentlyActivity";

// Helper function to format phone number for WhatsApp
const formatWhatsAppNumber = (phone: string | null | undefined): string => {
  if (!phone) return "";
  // Remove any non-digit characters
  const digits = phone.replace(/\D/g, "");
  // Ensure it starts with a country code if not already (using Spain's +34 as default)
  if (digits.startsWith("34")) {
    return digits;
  }
  return `34${digits}`;
};

export default function ClientDetailsPage() {
  const { userData } = useUser();
  const params = useParams();
  const { id } = params;
  const router = useTransitionRouter();
  const [client, setClient] = useState<ClientListItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchClient = async () => {
      if (!userData?.id || !id) return;

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/v2/clients/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userData.id,
            user_role: userData.role,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          // Handle 403 Forbidden errors
          if (response.status === 403) {
            showCustomToast({
              title: "Acceso denegado",
              message:
                data.error || "No tienes permisos para ver este cliente.",
              icon: ShieldAlertIcon,
              iconSize: 24,
              iconColor: "var(--danger-color)",
            });
            router.push("/clientes");
            return;
          }

          throw new Error(
            data.error || `Error ${response.status}: ${response.statusText}`
          );
        }

        // Validate response data
        if (!data.success || !data.data) {
          throw new Error("Los datos del cliente no están disponibles");
        }

        setClient(data.data);
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Error al obtener el cliente.";
        console.error("Error fetching client:", error);
        setError(errorMessage);

        showCustomToast({
          title: "Error",
          message: errorMessage,
          icon: ShieldAlertIcon,
          iconSize: 24,
          iconColor: "var(--danger-color)",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchClient();
  }, [id, router, userData]);

  // Contact handling functions
  const handleWhatsAppClick = () => {
    if (!client?.phone) {
      showCustomToast({
        title: "No hay teléfono",
        message: "Este cliente no tiene un número de teléfono registrado.",
        icon: ShieldAlertIcon,
        iconColor: "var(--warning-color)",
      });
      return;
    }

    const formattedPhone = formatWhatsAppNumber(client.phone);
    window.open(`https://wa.me/${formattedPhone}`, "_blank");
  };

  const handleEmailClick = () => {
    if (!client?.email) {
      showCustomToast({
        title: "No hay email",
        message: "Este cliente no tiene un correo electrónico registrado.",
        icon: ShieldAlertIcon,
        iconColor: "var(--warning-color)",
      });
      return;
    }

    window.location.href = `mailto:${client.email}`;
  };

  // Show loading state with better UX
  if (loading) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center p-6">
        <LoadingStateCard />
      </div>
    );
  }

  // Show error state with more context
  if (!userData || error || !client) {
    return <ClientError error={error} userData={userData} />;
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-4 border-b px-6 py-4 bg-white shadow-sm">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/clientes">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Volver</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold">
            {client.name} {client.last_name}
          </h1>
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">{client.email}</p>
            <Badge
              variant={client.type === "Empresa" ? "secondary" : "default"}
              className="ml-2"
            >
              {client.type}
            </Badge>
          </div>
        </div>

        {/* Contact Action Buttons */}
        <div className="ml-auto flex items-center gap-2">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleWhatsAppClick}
                  className="text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span className="sr-only">WhatsApp</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Contactar por WhatsApp</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleEmailClick}
                  className="text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                >
                  <Mail className="h-4 w-4" />
                  <span className="sr-only">Email</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Enviar email</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <AddTramiteDialog savedClient={client} />
        </div>
      </div>

      <main className="flex-1 p-4 md:p-6 bg-slate-50">
        <div className="space-y-6 max-w-[1800px] mx-auto">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="col-span-2">
              <ClientContactDetails client={client} />
            </div>
            <ClientRecentlyActivity client_id={client.id} />
          </div>

          <Tabs
            defaultValue="transactions"
            className="bg-white rounded-lg shadow-sm p-2"
          >
            <TabsList className="grid w-full grid-cols-2 md:w-auto mb-2">
              <TabsTrigger
                value="transactions"
                className="flex items-center gap-2"
              >
                <ListFilter className="h-4 w-4" />
                Trámites
              </TabsTrigger>
              <TabsTrigger value="files" className="flex items-center gap-2">
                <Folder className="h-4 w-4" />
                Archivos
              </TabsTrigger>
            </TabsList>
            <TabsContent value="transactions" className="mt-2">
              <ClientTramitesTable client_id={client.id} />
            </TabsContent>
            <TabsContent value="files" className="mt-2">
              <ClientFilesGrid client_id={client.id} />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
