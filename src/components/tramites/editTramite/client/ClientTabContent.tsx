"use client";
import { ClientDB, SignerDB } from "@/lib/core/types";
import { Home, Mail, Phone } from "lucide-react";
import EditClientDrawer from "./EditTramiteDrawer";

export default function ClientTabContent({
  client,
  onClientUpdated,
  isEditable,
  tramite_id,
  signer,
}: {
  client: ClientDB;
  onClientUpdated: () => void;
  isEditable: boolean | null;
  tramite_id: string;
  signer?: SignerDB | undefined;
}) {
  return (
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
        <div className="absolute bottom-4 left-0 w-full px-4">
          <EditClientDrawer
            tramite_id={tramite_id}
            client={client}
            onUpdate={onClientUpdated}
            signer={signer}
          />
        </div>
      )}
    </div>
  );
}
