"use client";
import { ClientDB, SignerDB } from "@/tramites/types";
import { Home, Mail, Phone } from "lucide-react";
import EditClientDrawer from "./EditTramiteDrawer";
import { User } from "@/core/types";

export default function ClientTabContent({
  client,
  onClientUpdated,
  isEditable,
  tramite_id,
  signer,
  userData,
}: {
  client: ClientDB;
  onClientUpdated: () => void;
  isEditable: boolean | null;
  tramite_id: string;
  signer?: SignerDB | undefined;
  userData: User;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Personal Information */}
        <div className="space-y-4">
          <div className="pb-3 border-b border-gray-200">
            <h3 className="text-sm font-medium text-gray-700">
              Información Personal
            </h3>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Nombre Completo</p>
              <p className="text-sm font-medium text-gray-800">
                {client.name} {client.last_name}
              </p>
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-1">Tipo de Cliente</p>
              <p className="text-sm font-medium text-gray-800">{client.type}</p>
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-1">Documento</p>
              <p className="text-sm font-medium text-gray-800">
                {client.document_type}: {client.document_number}
              </p>
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="space-y-4">
          <div className="pb-3 border-b border-gray-200">
            <h3 className="text-sm font-medium text-gray-700">
              Información de Contacto
            </h3>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <Mail className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {client.email}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Phone className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {client.phone}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Home className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {client.address}
                </p>
                <p className="text-xs text-gray-500">
                  {client.postal_code}, {client.city}, {client.province}
                </p>
              </div>
            </div>
          </div>

          {/* Financial Information */}
          <div className="pt-4">
            <div className="pb-3 border-b border-gray-200">
              <h3 className="text-sm font-medium text-gray-700">
                Información Financiera
              </h3>
            </div>

            <div className="mt-4">
              <p className="text-xs text-gray-500 mb-1">IBAN</p>
              <p className="text-sm font-medium text-gray-800 font-mono">
                {client.IBAN}
              </p>
            </div>
          </div>
        </div>
      </div>

      {isEditable && (
        <div className="pt-4 border-t border-gray-200">
          <EditClientDrawer
            tramite_id={tramite_id}
            client={client}
            onUpdate={onClientUpdated}
            signer={signer}
            userData={userData}
          />
        </div>
      )}
    </div>
  );
}
