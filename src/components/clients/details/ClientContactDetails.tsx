import { memo } from "react";
import { ClientListItem } from "../ClientsList";
import {
  Mail,
  Phone,
  MapPin,
  Wallet,
  IdCard,
  Building2,
  User,
  ExternalLink,
  MessageCircle,
} from "lucide-react";
import ClientMap from "./ClientMap";
import ClientDetailCard from "./ClientDetailCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/core/utils";

// Memoized detail item to avoid re-renders
const DetailItem = memo(
  ({
    icon: Icon,
    title,
    value,
    className = "",
    actionIcon: ActionIcon,
    actionLabel,
    onAction,
  }: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    value: string | number | null | undefined;
    className?: string;
    actionIcon?: React.ComponentType<{ className?: string }>;
    actionLabel?: string;
    onAction?: () => void;
  }) => (
    <div className={cn("flex items-start gap-3", className)}>
      <Icon className="h-4 w-4 text-primary mt-1" />
      <div className="flex-1">
        <p className="font-medium text-sm text-muted-foreground">{title}</p>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">{value || "—"}</p>
          {ActionIcon && onAction && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onAction}
              className="h-7 px-2 text-xs text-primary hover:bg-primary/10 hover:text-primary-800 focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <ActionIcon className="h-4 w-4" />
              {actionLabel || "Contactar"}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
);

DetailItem.displayName = "DetailItem";

// Format address to avoid undefined values
const formatAddress = (client: ClientListItem) => {
  const parts = [
    client.address,
    client.postal_code,
    client.city,
    client.province,
  ].filter(Boolean);
  return parts.join(", ");
};

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

export default function ClientContactDetails({
  client,
}: {
  client: ClientListItem;
}) {
  const isCompany = client.type === "Empresa";
  const contactTitle = isCompany
    ? `${client.name} ${client.last_name || ""}`
    : `${client.name} ${client.last_name || ""}`;

  // Contact action handlers
  const handleEmailClick = () => {
    if (client.email) {
      window.location.href = `mailto:${client.email}`;
    }
  };

  const handlePhoneClick = () => {
    if (client.phone) {
      const formattedPhone = formatWhatsAppNumber(client.phone);
      window.open(`https://wa.me/${formattedPhone}`, "_blank");
    }
  };

  const handleMapClick = () => {
    if (client.address) {
      const query = encodeURIComponent(formatAddress(client));
      window.open(`https://maps.google.com/?q=${query}`, "_blank");
    }
  };

  return (
    <ClientDetailCard
      title="Información de Contacto"
      icon={isCompany ? Building2 : User}
      contentClassName="p-0 h-full"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 h-full">
        <div className="space-y-4 p-6">
          {/* Client type-specific information */}
          <DetailItem
            icon={isCompany ? Building2 : User}
            title={isCompany ? "Empresa" : "Nombre Completo"}
            value={contactTitle}
            className="pb-2 border-b"
          />

          <DetailItem
            icon={Mail}
            title="Email"
            value={client.email}
            actionIcon={Mail}
            actionLabel="Enviar email"
            onAction={client.email ? handleEmailClick : undefined}
          />
          <DetailItem
            icon={Phone}
            title="Teléfono"
            value={client.phone}
            actionIcon={MessageCircle}
            actionLabel="WhatsApp"
            onAction={client.phone ? handlePhoneClick : undefined}
          />
          <DetailItem
            icon={MapPin}
            title="Dirección"
            value={formatAddress(client)}
            actionIcon={ExternalLink}
            actionLabel="Ver en mapa"
            onAction={client.address ? handleMapClick : undefined}
          />
          <DetailItem
            icon={IdCard}
            title={client.document_type || "Documento"}
            value={client.document_number}
          />
          <DetailItem
            icon={Wallet}
            title="Número de Cuenta"
            value={client.IBAN}
          />
        </div>
        <div className="h-full min-h-[320px]">
          <ClientMap
            className="w-full h-full min-h-[320px]"
            coordinates={client.coordinates as [number, number]}
          />
        </div>
      </div>
    </ClientDetailCard>
  );
}
