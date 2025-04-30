"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CircleX } from "lucide-react";
import {
  EditTramiteFormData,
  createEmptyTramiteForm,
  SignerDB,
  TramiteFile,
  User,
} from "@/lib/core/types";
import { useUser } from "@/lib/contexts/UserContext";
import { useParams, useRouter } from "next/navigation";
import { TramiteNotesSection } from "@/components/tramites/editTramite/notes/NotesTabContent";
import ContractSection from "@/components/tramites/editTramite/contract/ContractSection";
import { showCustomToast } from "@/components/core/CustomToast";
import TramiteFilesSection from "@/components/tramites/editTramite/files/TramitesFilesSection";
import TramiteTimeLineSection from "@/components/tramites/editTramite/TramiteTimeLineSection";
import TramiteClientSection from "@/components/tramites/editTramite/client/TramiteClientSection";
import TramiteComercialSection from "@/components/tramites/editTramite/comercial/TramiteComercialSection";
import TramiteComissionsSection from "@/components/tramites/editTramite/comissions/TramiteComissionsSection";
import TramiteStatusSection from "@/components/tramites/editTramite/TramiteStatusSection";
import LiquidezStatusSection from "@/components/tramites/editTramite/liquidez/LiquidezStatusSection";
import FullScreenLoaderComponent from "@/components/core/FullScreenLoaderComponent";

export default function TramiteDetails() {
  const { userData } = useUser();
  const { id } = useParams();
  const router = useRouter();
  const [formData, setFormData] = useState<EditTramiteFormData>(
    createEmptyTramiteForm()
  );
  const isSubcomercial = userData && userData.role === "2" && userData.super_id;
  const isComercial = userData && userData.role === "2";
  const [loading, setLoading] = useState(true);
  const [loadedData, setLoadedData] = useState(false);

  const fetchTramite = useCallback(async () => {
    if (!userData?.id || !userData?.role) return;

    try {
      const rs = await fetch(`/api/tramites/get/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          user_id: userData.id,
          role: userData.role,
        }),
      });

      // Comprobar primero el estado HTTP de la respuesta
      if (rs.status === 403) {
        showCustomToast({
          title: "Acceso denegado",
          message: "No tienes permiso para acceder a este trámite",
          icon: CircleX,
          iconSize: 24,
          iconColor: "var(--danger-color)",
        });
        router.push("/tramites");
        return;
      }

      if (!rs.ok) {
        const errorData = await rs.json();
        showCustomToast({
          title: "Error",
          message: errorData.error || "Error al cargar el trámite",
          icon: CircleX,
          iconSize: 24,
          iconColor: "var(--danger-color)",
        });
        router.push("/tramites");
        return;
      }

      const { success, data } = await rs.json();

      if (success && data) {
        setFormData({
          ...data,
          signer: data.signer || ({} as SignerDB),
        });
        setLoadedData(true);
      } else {
        // Si no hay datos pero la respuesta fue exitosa (caso extraño), redirigir de todas formas
        showCustomToast({
          title: "Error",
          message: "No se encontraron datos del trámite",
          icon: CircleX,
          iconSize: 24,
          iconColor: "var(--danger-color)",
        });
        router.push("/tramites");
        return;
      }
    } catch (error) {
      console.error("Error en la solicitud:", error);
      showCustomToast({
        title: "Error",
        message: "Error de conexión",
        icon: CircleX,
        iconSize: 24,
        iconColor: "var(--danger-color)",
      });
      router.push("/tramites");
      return;
    } finally {
      setLoading(false);
    }
  }, [id, userData?.id, userData?.role, router]);

  useEffect(() => {
    fetchTramite();
  }, [fetchTramite]);

  const { tramite, client, contracts, files, signer } = formData;

  const isEditable =
    userData &&
    (userData.role === "admin" ||
      (userData.role === "1" &&
        tramite.status !== "Activo" &&
        tramite.status !== "Baja") ||
      (userData.role === "2" && tramite.status === "Borrador"));

  const isTramitableBorrador =
    tramite.status === "Tramitable" || tramite.status === "Borrador";

  const isRenewable =
    new Date(tramite.renovation_date) <=
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  if (loading || !loadedData) {
    return (
      <FullScreenLoaderComponent
        title="Cargando trámite..."
        description="Espere unos segundos mientras se cargan los datos del trámite."
      />
    );
  }

  return (
    <div className=" mx-12 py-6 ">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary-800">
            Detalles del Trámite
          </h1>
          <p className="text-primary-400">ID: {tramite.id}</p>
        </div>
        <TramiteStatusSection
          tramite={tramite}
          userData={userData as User}
          onUpdate={fetchTramite}
          isEditable={isEditable}
          isRenewable={isRenewable}
          onRenew={fetchTramite}
          client={client}
        />
      </div>

      {/* Timeline Card */}
      <TramiteTimeLineSection
        tramite={tramite}
        isComercial={isComercial as boolean}
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        {/* Client Info Card */}
        <TramiteClientSection
          client={client}
          signer={signer}
          onUpdated={fetchTramite}
          isEditable={isEditable as boolean}
          tramite_id={tramite.id}
        />

        {/* Commission Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-primary-800">
              Información Adicional
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <TramiteComercialSection
              user={tramite.user as User}
              isEditable={isEditable}
              userData={userData as User}
              tramite_id={tramite.id}
              onUpdate={fetchTramite}
            />

            {!isSubcomercial && (
              <>
                <Separator />

                <TramiteComissionsSection
                  tramite={tramite}
                  userData={userData as User}
                  onUpdate={fetchTramite}
                  isEditable={isEditable}
                />

                <Separator />

                <LiquidezStatusSection
                  tramite={tramite}
                  isComercial={isComercial as boolean}
                  userData={userData as User}
                  onUpdate={fetchTramite}
                  client={client}
                />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Contracts Section */}
      <ContractSection
        contracts={contracts}
        tramite_id={tramite.id}
        onContractAdded={fetchTramite}
        onContractUpdated={fetchTramite}
        isEditable={isEditable}
      />

      {/* Notes Section */}

      <TramiteNotesSection
        notes={tramite.notes}
        onDeletedNote={fetchTramite}
        onAddNote={fetchTramite}
        tramite_id={tramite.id}
        user_id={userData?.id as string}
        user_name={userData?.name as string}
        client={client}
      />

      {/* Files Section */}
      <TramiteFilesSection
        files={files as TramiteFile[]}
        userData={userData as User}
        tramite={tramite}
        onUpload={fetchTramite}
        isEditable={isEditable}
        isTramitableBorrador={isTramitableBorrador}
        client={client}
      />
    </div>
  );
}
