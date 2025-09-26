"use client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/core/components/ui/card";
import { useState } from "react";
import { ClientViewToggle, ClientView } from "./ClientViewToggle";
import ClientTabContent from "./ClientTabContent";
import SignerTabContent from "./SignerTabContent";
import { ClientDB, SignerDB } from "@/tramites/types";
import { User } from "@/core/types";

interface Props {
  client: ClientDB;
  signer: SignerDB;
  onUpdated: () => void;
  isEditable: boolean;
  tramite_id: string;
  userData: User;
}

export default function TramiteClientSection({
  client,
  signer,
  onUpdated,
  isEditable,
  tramite_id,
  userData,
}: Props) {
  const [currentView, setCurrentView] = useState<ClientView>("client");
  const isEmpresaOrComunidad =
    client.type === "Empresa" || client.type === "Comunidad de Propietarios";

  return (
    <Card className="xl:col-span-2 ">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
          <div className="h-2 w-2 bg-gray-600 rounded-full"></div>
          Información del Cliente
        </CardTitle>
        <CardDescription className="text-sm text-gray-500 mt-1">
          {isEmpresaOrComunidad
            ? "Cliente empresarial con firmante"
            : "Cliente individual"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Client/Signer Toggle */}
        {isEmpresaOrComunidad && (
          <ClientViewToggle
            currentView={currentView}
            onViewChange={setCurrentView}
            showSigner={isEmpresaOrComunidad}
            className="space-y-4"
          />
        )}

        {/* Content based on current view */}
        {currentView === "client" && (
          <div className={isEmpresaOrComunidad ? "mt-0" : ""}>
            <ClientTabContent
              client={client}
              onClientUpdated={onUpdated}
              isEditable={isEditable}
              tramite_id={tramite_id}
              signer={isEmpresaOrComunidad ? signer : undefined}
              userData={userData}
            />
          </div>
        )}

        {currentView === "signer" && isEmpresaOrComunidad && (
          <div className="mt-0">
            <SignerTabContent
              signer={signer}
              onSignerUpdated={onUpdated}
              isEditable={false}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
