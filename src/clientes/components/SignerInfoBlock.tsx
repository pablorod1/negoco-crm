"use client";

import {
  BriefcaseBusiness,
  IdCard,
  Mail,
  Phone,
  UserRound,
} from "lucide-react";
import { SignerEditor } from "@/clientes/components/SignerEditor";
import type { SignerDB } from "@/tramites/types";

interface Props {
  clientId: string;
  signer: SignerDB | null | undefined;
  canEdit: boolean;
  onUpdated: () => void;
}

export function SignerInfoBlock({
  clientId,
  signer,
  canEdit,
  onUpdated,
}: Props) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <UserRound className="size-4 text-gray-400" />
          Firmante
        </p>
        {canEdit ? (
          <SignerEditor
            clientId={clientId}
            signer={signer ?? null}
            onUpdated={onUpdated}
          />
        ) : null}
      </div>

      {signer ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs text-gray-500">Nombre completo</p>
            <p className="text-sm font-medium text-gray-900">
              {signer.name} {signer.last_name}
            </p>
          </div>
          <div className="flex items-start gap-2">
            <IdCard className="mt-0.5 size-3.5 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Documento</p>
              <p className="text-sm font-medium text-gray-900">
                {signer.document_number || "—"}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Mail className="mt-0.5 size-3.5 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Email</p>
              <p className="text-sm font-medium text-gray-900">
                {signer.email || "—"}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Phone className="mt-0.5 size-3.5 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Teléfono</p>
              <p className="text-sm font-medium text-gray-900">
                {signer.phone || "—"}
              </p>
            </div>
          </div>
          {signer.cargo ? (
            <div className="flex items-start gap-2 sm:col-span-2">
              <BriefcaseBusiness className="mt-0.5 size-3.5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Cargo</p>
                <p className="text-sm font-medium text-gray-900">
                  {signer.cargo}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-gray-500">No hay firmante registrado.</p>
      )}
    </section>
  );
}
