"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { InfoIcon, RefreshCcw, CircleX } from "lucide-react";
import {
  EditTramiteFormData,
  createEmptyTramiteForm,
  SignerDB,
  TramiteFile,
  User,
} from "@/lib/core/types";
import { useUser } from "@/lib/contexts/UserContext";
import { useParams } from "next/navigation";
import { getStatusBadge } from "@/lib/hooks/use-status-badge";
import { Tooltip } from "@heroui/tooltip";
import { TramiteNotesSection } from "@/components/tramites/editTramite/notes/NotesTabContent";
import ContractSection from "@/components/tramites/editTramite/contract/ContractSection";
import { showCustomToast } from "@/components/core/CustomToast";
import TramiteFilesSection from "@/components/tramites/editTramite/files/TramitesFilesSection";
import TramiteTimeLineSection from "@/components/tramites/editTramite/TramiteTimeLineSection";
import TramiteClientSection from "@/components/tramites/editTramite/client/TramiteClientSection";
import TramiteComercialSection from "@/components/tramites/editTramite/comercial/TramiteComercialSection";
import TramiteComissionsSection from "@/components/tramites/editTramite/comissions/TramiteComissionsSection";
import TramiteStatusSection from "@/components/tramites/editTramite/TramiteStatusSection";
import SpinnerComponent from "@/components/core/SpinnerComponent";

export default function TramiteDetails() {
  const { userData } = useUser();
  const { id } = useParams();
  const [formData, setFormData] = useState<EditTramiteFormData>(
    createEmptyTramiteForm()
  );
  const isSubcomercial = userData && userData.role === "2" && userData.super_id;
  const isComercial = userData && userData.role === "2";
  const [loading, setLoading] = useState(true);

  const fetchTramite = useCallback(async () => {
    if (!userData?.id || !userData?.role) return;

    try {
      const rs = await fetch(`/api/tramites/get/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          user_id: userData.id,
          user_role: userData.role,
        }),
      });

      const { success, error, data } = await rs.json();
      if (!success) {
        showCustomToast({
          title: "Error al obtener el trámite",
          message: error,
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: CircleX,
        });
        return;
      }
      console.log("data", data);
      if (data) {
        setFormData({
          ...data,
          signer: data.signer || ({} as SignerDB),
        });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [id, userData?.id, userData?.role]);

  useEffect(() => {
    fetchTramite();
  }, [fetchTramite]);

  const { tramite, client, contracts, files, signer } = formData;

  const isEditable =
    userData &&
    (userData.role === "admin" ||
      userData.role === "1" ||
      (userData.role === "2" &&
        (tramite.status === "Borrador" || tramite.status === "Tramitable"))) &&
    tramite.status !== "Activo";

  const isRenewable =
    new Date(tramite.renovation_date) <=
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  return (
    <>
      {loading ? (
        <div className="min-h-screen flex items-center justify-center">
          <SpinnerComponent userData={userData as User} />
        </div>
      ) : (
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
            />
          </div>

          {/* Timeline Card */}
          <TramiteTimeLineSection tramite={tramite} />

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
            {/* Client Info Card */}
            <TramiteClientSection
              client={client}
              signer={signer}
              isEditable={isEditable}
              onUpdated={fetchTramite}
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

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-primary-400">
                          Estado de Liquidez
                        </p>
                        <Tooltip
                          radius="sm"
                          content={
                            <div className="max-w-sm flex items-start gap-2">
                              <RefreshCcw className="size-6 text-primary-800" />
                              <div className="flex flex-col gap-1">
                                <h3 className=" font-semibold text-primary-800">
                                  Actualización Automática
                                </h3>
                                <p className="text-primary-500">
                                  El estado de liquidez cambiará automáticamente
                                  a <strong>Pendiente de Cobro</strong> cuando
                                  el estado del trámite cambie a{" "}
                                  <strong>Activo</strong>.
                                </p>
                              </div>
                            </div>
                          }
                        >
                          <InfoIcon className="size-3 text-gray-600" />
                        </Tooltip>
                      </div>
                      {!isComercial ||
                      tramite.liquidez_status === "Pagado al Comercial" ? (
                        <>{getStatusBadge(tramite.liquidez_status)}</>
                      ) : (
                        <span>---</span>
                      )}
                    </div>
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
          />

          {/* Files Section */}
          <TramiteFilesSection
            files={files as TramiteFile[]}
            userData={userData as User}
            tramite={tramite}
            onUpload={fetchTramite}
            isEditable={isEditable}
          />
        </div>
      )}
    </>
  );
}
