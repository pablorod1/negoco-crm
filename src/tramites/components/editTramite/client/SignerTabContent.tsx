import { SignerDB } from "@/tramites/types";
import { BriefcaseBusiness, IdCard, Mail, Phone } from "lucide-react";
import EditDrawer from "./EditTramiteDrawer";

interface Props {
  signer: SignerDB;
  onSignerUpdated: () => void;
  isEditable: boolean | null;
}

export default function SignerTabContent({
  signer,
  onSignerUpdated,
  isEditable,
}: Props) {
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
                {signer.name} {signer.last_name}
              </p>
            </div>

            <div className="flex items-start gap-2">
              <IdCard className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Documento</p>
                <p className="text-sm font-medium text-gray-800">
                  {signer.document_number}
                </p>
              </div>
            </div>

            {signer.cargo && (
              <div className="flex items-start gap-2">
                <BriefcaseBusiness className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Cargo</p>
                  <p className="text-sm font-medium text-gray-800">
                    {signer.cargo}
                  </p>
                </div>
              </div>
            )}
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
                  {signer.email}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Phone className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {signer.phone}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isEditable && (
        <div className="pt-4 border-t border-gray-200">
          <EditDrawer signer={signer} onUpdate={onSignerUpdated} />
        </div>
      )}
    </div>
  );
}
