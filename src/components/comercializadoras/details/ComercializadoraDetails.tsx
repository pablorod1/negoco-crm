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
import { User } from "@/lib/core/types";
import { useUser } from "@/lib/contexts/UserContext";

function ErrorState({ message }: { message: string }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center p-8 bg-white rounded-xl shadow-sm border max-w-md">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <FileText className="h-8 w-8 text-red-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Error al cargar
        </h3>
        <p className="text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

export default function ComercializadoraDetails() {
  const { userData } = useUser();
  const params = useParams();
  const { id } = params;
  const { comercializadora, loading, error, refetch } = useComercializadora(id);

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
      <div className="px-12 py-6 space-y-8">
        <ComercializadoraDetailsHeader comercializadora={comercializadora} />

        <ComercializadoraMainCard comercializadora={comercializadora} />

        {/* <ComercializadoraRatesSection rates={comercializadora.rates || []} /> */}

        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <Tabs defaultValue="tramites" className="w-full">
            <div className="border-b bg-gray-50/50 px-6 py-4">
              <TabsList className="grid w-full max-w-md grid-cols-2 bg-white shadow-sm">
                <TabsTrigger
                  value="tramites"
                  className="flex items-center gap-2 data-[state=active]:bg-primary-500 data-[state=active]:text-white"
                >
                  <ClipboardList className="h-4 w-4" />
                  <span className="hidden sm:inline">Trámites</span>
                  <span className="bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full text-xs font-medium">
                    {comercializadora.num_tramites}
                  </span>
                </TabsTrigger>
                <TabsTrigger
                  value="documentos"
                  className="flex items-center gap-2 data-[state=active]:bg-primary-500 data-[state=active]:text-white"
                >
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Documentos</span>
                  <span className="bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full text-xs font-medium">
                    {comercializadora.num_files || 0}
                  </span>
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="tramites" className="p-6 m-0">
              <ComercializadoraTramitesTable
                name={comercializadora.name}
                userData={userData as User}
              />
            </TabsContent>

            <TabsContent value="documentos" className="p-6 m-0">
              <ComercializadoraDocumentsList
                files={comercializadora.files}
                userData={userData as User}
                comercializadora={comercializadora}
                refetch={refetch}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
