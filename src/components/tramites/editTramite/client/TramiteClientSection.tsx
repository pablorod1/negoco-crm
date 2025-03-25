import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserIcon } from "lucide-react";
import ClientTabContent from "./ClientTabContent";
import SignerTabContent from "./SignerTabContent";
import { ClientDB, SignerDB } from "@/lib/core/types";

interface Props {
  client: ClientDB;
  signer: SignerDB;
  isEditable: boolean | null;
  onUpdated: () => void;
}

export default function TramiteClientSection({
  client,
  signer,
  isEditable,
  onUpdated,
}: Props) {
  return (
    <Card className="xl:col-span-2">
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

          <TabsContent value="client" className="space-y-4 h-full">
            <ClientTabContent
              client={client}
              onClientUpdated={onUpdated}
              isEditable={isEditable}
            />
          </TabsContent>
          {(client.type === "Empresa" ||
            client.type === "Comunidad de Propietarios") && (
            <TabsContent value="signer" className="space-y-4">
              <SignerTabContent
                signer={signer}
                onSignerUpdated={onUpdated}
                isEditable={isEditable}
              />
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
}
