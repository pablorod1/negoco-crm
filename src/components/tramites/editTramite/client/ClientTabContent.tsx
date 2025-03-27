"use client";
import { ClientDB } from "@/lib/core/types";
import { Home, Mail, Phone, UserPen } from "lucide-react";
import EditClientDrawer from "./EditClientDrawer";
import { Button } from "@heroui/button";
import { useDisclosure } from "@heroui/modal";

export default function ClientTabContent({
  client,
  onClientUpdated,
  isEditable,
}: {
  client: ClientDB;
  onClientUpdated: () => void;
  isEditable: boolean | null;
}) {
  const { isOpen, onClose, onOpen } = useDisclosure();
  return (
    <>
      <div className="space-y-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-primary-400">
                Nombre Completo
              </p>
              <p className="font-medium ">
                {client.name} {client.last_name}
              </p>
            </div>
            <div className="flex items-start gap-2">
              <Mail className="h-4 w-4 text-primary-400 mt-1" />
              <p className=" font-medium">{client.email}</p>
            </div>
            <div className="flex items-start gap-2">
              <Phone className="h-4 w-4 text-primary-400 mt-1" />
              <p className=" font-medium">{client.phone}</p>
            </div>
            <div className="flex items-start gap-2">
              <Home className="h-4 w-4 text-primary-400 mt-1" />
              <p className=" font-medium">
                {client.address}, {client.postal_code}, {client.province},{" "}
                {client.city}
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-primary-400">
                Tipo de Cliente
              </p>
              <p className="font-medium ">{client.type}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-primary-400">Documento</p>
              <p className="font-medium ">
                {client.document_type}: {client.document_number}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-primary-400">IBAN</p>
              <p className="font-medium ">{client.IBAN}</p>
            </div>
          </div>
        </div>
        {isEditable && (
          <Button
            variant="bordered"
            color="primary"
            radius="sm"
            onPress={onOpen}
            startContent={<UserPen size={16} />}
          >
            Editar Cliente
          </Button>
        )}
      </div>
      <EditClientDrawer
        client={client}
        isOpen={isOpen}
        onClose={onClose}
        onClientUpdated={onClientUpdated}
      />
    </>
  );
}
