"use client";

import { FileText, ClipboardList } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useParams } from "next/navigation";

import { useComercializadora } from "@/lib/hooks/comercializadoras/useComercializadora";
import { ComercializadoraDetailsHeader } from "./ComercializadoraDetailsHeader";
import { ComercializadoraMainCard } from "./ComercializadoraMainCard";
import { ComercializadoraTramitesTable } from "./ComercializadoraTramitesTable";
import { ComercializadoraDocumentsList } from "./ComercializadoraDocumentsList";
import FullScreenLoaderComponent from "@/components/core/FullScreenLoaderComponent";

function ErrorState({ message }: { message: string }) {
  return (
    <div className="p-6">
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}

export default function ComercializadoraDetails() {
  const params = useParams();
  const { id } = params;
  const { comercializadora, loading, error } = useComercializadora(id);

  if (loading) {
    return <FullScreenLoaderComponent />;
  }

  if (error || !comercializadora) {
    return (
      <ErrorState
        message={
          error ||
          "La comercializadora no existe o no se ha cargado correctamente."
        }
      />
    );
  }

  return (
    <div className="p-6 space-y-6">
      <ComercializadoraDetailsHeader />

      <ComercializadoraMainCard comercializadora={comercializadora} />

      {/* <ComercializadoraRatesSection rates={comercializadora.rates} /> */}

      <Tabs defaultValue="tramites" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tramites" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Trámites ({comercializadora.num_tramites})
          </TabsTrigger>
          <TabsTrigger value="documentos" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Documentos ({comercializadora.num_files || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tramites">
          <ComercializadoraTramitesTable name={comercializadora.name} />
        </TabsContent>

        <TabsContent value="documentos">
          <ComercializadoraDocumentsList files={comercializadora.files} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
