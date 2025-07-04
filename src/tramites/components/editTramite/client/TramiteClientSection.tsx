"use client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/core/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/core/components/ui/tabs";
import { UserIcon } from "lucide-react";
import ClientTabContent from "./ClientTabContent";
import SignerTabContent from "./SignerTabContent";
import { ClientDB, SignerDB } from "@/tramites/types";

interface Props {
  client: ClientDB;
  signer: SignerDB;
  onUpdated: () => void;
  isEditable: boolean;
  tramite_id: string;
}

export default function TramiteClientSection({
  client,
  signer,
  onUpdated,
  isEditable,
  tramite_id,
}: Props) {
  const isEmpresaOrComunidad =
    client.type === "Empresa" || client.type === "Comunidad de Propietarios";
  return (
    <Card className="xl:col-span-2 relative">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary-800">
          <UserIcon className="h-5 w-5" />
          Información del Cliente
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="client">
          <TabsList
            className={`grid mb-4 ${
              client.type === "Empresa" ||
              client.type === "Comunidad de Propietarios"
                ? "grid-cols-2"
                : "grid-cols-1"
            }`}
          >
            <TabsTrigger value="client">Cliente - {client.id}</TabsTrigger>
            {(client.type === "Empresa" ||
              client.type === "Comunidad de Propietarios") && (
              <TabsTrigger value="signer">Firmante - {signer.id}</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="client" className="space-y-4 h-full ">
            <ClientTabContent
              client={client}
              onClientUpdated={onUpdated}
              isEditable={isEditable}
              tramite_id={tramite_id}
              signer={isEmpresaOrComunidad ? signer : undefined}
            />
          </TabsContent>
          {isEmpresaOrComunidad && (
            <TabsContent value="signer" className="space-y-4">
              <SignerTabContent
                signer={signer}
                onSignerUpdated={onUpdated}
                isEditable={false}
              />
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
}
