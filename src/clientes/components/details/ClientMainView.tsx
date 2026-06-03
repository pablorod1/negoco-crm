import { ClientListItem } from "@/clientes/components/ClientsList";
import { User } from "@/core/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/core/components/ui/tooltip";
import { Badge } from "@/core/components/ui/badge";
import {
  User as UserIcon,
  Info,
  Mail,
  MessageCircle,
  Phone,
  MapPin,
  Building2,
  IdCard,
} from "lucide-react";
import AddTramiteDialog from "@/tramites/components/createTramite/AddTramiteDialog";
import { showCustomToast } from "@/core/components/CustomToast";
import ClientMap from "./ClientMap";
import EditDrawer from "@/tramites/components/editTramite/client/EditTramiteDrawer";
import { SignerEditor } from "@/clientes/components/SignerEditor";

// Helper function to format phone number for WhatsApp
const formatWhatsAppNumber = (phone: string | null | undefined): string => {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("34")) {
    return digits;
  }
  return `34${digits}`;
};

interface ClientMainViewProps {
  client: ClientListItem;
  userData: User;
  onUpdate: () => void;
}

export default function ClientMainView({
  client,
  onUpdate,
  userData,
}: ClientMainViewProps) {
  const canEditSigner =
    client.type === "Empresa" || client.type === "Comunidad de Propietarios";

  // Contact handling functions
  const handleWhatsAppClick = () => {
    if (!client?.phone) {
      showCustomToast({
        title: "No hay teléfono",
        message: "Este cliente no tiene un número de teléfono registrado.",
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
        iconColor: "var(--warning-color)",
      });
      return;
    }

    window.location.href = `mailto:${client.email}`;
  };

  return (
    <div className="space-y-6">
      {/* Hero Section - 3 Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card 1: Estado y Acciones */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Info className="h-4 w-4" />
              Estado y Acciones
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Separador visual */}
            <div className="border-t border-gray-100"></div>

            {/* Acciones de contacto */}
            <div className="space-y-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                Acciones de contacto
              </p>

              <div className="flex flex-col gap-2">
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleWhatsAppClick}
                        className="justify-start text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
                      >
                        <MessageCircle className="h-4 w-4 mr-2" />
                        WhatsApp
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>Contactar por WhatsApp</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleEmailClick}
                        className="justify-start text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        Email
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>Enviar email</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            {/* Separador visual */}
            <div className="border-t border-gray-100"></div>

            {/* Acciones de gestión */}
            <div className="space-y-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                Gestión
              </p>
              <AddTramiteDialog savedClient={client} />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Información de Contacto */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
                <UserIcon className="h-4 w-4" />
                Información del Cliente - {client.name} {client.last_name}
              </CardTitle>
              <div className="flex items-center gap-2">
                {client.tramites_count === 0 ? (
                  <EditDrawer
                    userData={userData}
                    client={client}
                    onUpdate={onUpdate}
                  />
                ) : null}
                {canEditSigner ? (
                  <SignerEditor
                    clientId={client.id}
                    signer={client.signer ?? null}
                    onUpdated={onUpdate}
                  />
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 grid grid-cols-2">
            {/* Email */}
            <div className="space-y-6">
              <span className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-4">
                Información de Contacto
              </span>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Mail className="h-3 w-3 text-gray-400" />
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                    Email
                  </p>
                </div>
                <p className="text-sm font-medium text-gray-900 ml-5">
                  {client.email || "—"}
                </p>
              </div>
              {/* Teléfono */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Phone className="h-3 w-3 text-gray-400" />
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                    Teléfono
                  </p>
                </div>
                <p className="text-sm font-medium text-gray-900 ml-5">
                  {client.phone || "—"}
                </p>
              </div>
              {/* Dirección */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <MapPin className="h-3 w-3 text-gray-400" />
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                    Dirección
                  </p>
                </div>
                <p className="text-sm font-medium text-gray-900 ml-5">
                  {client.address}, {client.city}, {client.province}{" "}
                  {client.postal_code}
                </p>
              </div>
            </div>
            <div className="space-y-6">
              <span className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-4">
                Información General
              </span>
              {/* Estado del cliente */}
              <div className="space-y-2">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                  Tipo de cliente
                </p>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      client.type === "Empresa" ? "secondary" : "default"
                    }
                    className="text-xs"
                  >
                    {client.type}
                  </Badge>
                </div>
              </div>
              {/* CIF/NIF */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <IdCard className="h-3 w-3 text-gray-400" />
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                    {client.document_type}
                  </p>
                </div>
                <p className="text-sm font-medium text-gray-900 ml-5">
                  {client.document_number || "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {client.coordinates ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Ubicación del Cliente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-full min-h-[320px] w-full rounded-4xl overflow-hidden">
              <ClientMap
                width="100%"
                height={"520px"}
                coordinates={client.coordinates as [number, number]}
              />
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
