"use client";
import {
  EditTramiteFormData,
  createEmptyTramiteForm,
  ContractDB,
  User,
  SignerDB,
  Notification,
} from "@/lib/core/types";
import { Button, Divider, Spinner } from "@heroui/react";
import { useCallback, useEffect, useState } from "react";
import { EditFormWrapper } from "../EditFormWrapper";
import ContractPreview from "../../createTramite/ContractPreview";
import { trackChanges } from "@/hooks/track-tramite-changes";
import NotesBoard from "../NotesBoard";
import CreateContractDrawer from "../../createTramite/CreateContractDrawer";
import { useTramites } from "@/contexts/TramitesContext";
import TramiteForm from "./TramiteForm";
import { useUser } from "@/contexts/UserContext";
import EditClientForm from "./EditClientForm";
import EditTramiteFiles from "./EditTramiteFiles";
import { generateTramiteUpdatedNotification } from "@/lib/core/notifications.helpers";
import { CheckCircle, CircleX, PencilOff } from "lucide-react";
import CancelEditTramiteConfirmationModal from "../CancelEditTramiteConfirmationModal";
import { showCustomToast } from "@/components/core/CustomToast";

interface Props {
  tramite_id: string;
  onSubmit: () => void;
  onCancel: () => void;
}

export default function EditTramiteForm({
  tramite_id,
  onCancel,
  onSubmit,
}: Props) {
  const { userData } = useUser();
  const [formData, setFormData] = useState<EditTramiteFormData>(
    createEmptyTramiteForm(userData as User)
  );
  const [originalData, setOriginalData] = useState<EditTramiteFormData>(
    createEmptyTramiteForm(userData as User)
  );
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const { refreshTramites } = useTramites();

  const checkChanges = () => {
    if (
      uploadedFiles.length === 0 &&
      JSON.stringify(formData) === JSON.stringify(originalData)
    ) {
      return false;
    }
    return true;
  };

  const handleCreateContract = (contract: ContractDB) => {
    setFormData((prev) => ({
      ...prev,
      contracts: [...prev.contracts, contract],
    }));
  };

  const checkRole = () => {
    if (userData) {
      if (
        userData.role === "2" &&
        (formData.tramite.status === "Tramitable" ||
          formData.tramite.status === "Borrador")
      ) {
        return true;
      } else if (userData.role !== "2") {
        return true;
      }

      return false;
    }
  };

  const fetchTramite = useCallback(async () => {
    const res = await fetch(`/api/tramites/get/tramite-by-id?id=${tramite_id}`);
    const { data, success } = await res.json();
    if (!success) {
      showCustomToast({
        title: "Error al obtener el trámite",
        message: "Inténtalo de nuevo más tarde",
        iconColor: "var(--danger-color)",
        iconSize: 24,
        icon: CircleX,
      });
      return;
    }

    if (data) {
      setFormData({
        ...data,
        signer: data.signer || ({} as SignerDB),
      });
      setOriginalData({
        ...data,
        signer: data.signer || ({} as SignerDB),
      });
    }
  }, [tramite_id]);

  useEffect(() => {
    fetchTramite();
  }, [fetchTramite]);

  const handleUpdateContract = (contract: ContractDB) => {
    setFormData((prev) => ({
      ...prev,
      contracts: prev.contracts.map((c) =>
        c.id === contract.id ? contract : c
      ),
    }));
  };

  const handleUpdateNotes = (note: string) => {
    setFormData((prev) => ({
      ...prev,
      tramite: {
        ...prev.tramite,
        notes: [...prev.tramite.notes, note],
      },
    }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    const changes = trackChanges(originalData, formData);
    if (changes.tramite?.status === "Baja") {
      changes.tramite.comision = formData.tramite.comision;
      changes.tramite.comision_sales_person =
        formData.tramite.comision_sales_person;
    }

    if (
      changes.tramite?.status === "Activo" &&
      (!formData.tramite.comision || !formData.tramite.comision_sales_person)
    ) {
      showCustomToast({
        title: "Error al actualizar trámite",
        message: "Debes ingresar la comisión y el comercial de la comisión",
        iconColor: "var(--danger-color)",
        iconSize: 24,
        icon: CircleX,
      });
      setLoading(false);
    }
    if (
      !changes.client &&
      !changes.tramite &&
      !changes.signer &&
      !changes.contracts &&
      !uploadedFiles.length
    ) {
      showCustomToast({
        title: "No hay cambios",
        message: "No se han realizado cambios en el trámite",
        iconColor: "var(--warning-color)",
        iconSize: 24,
        icon: PencilOff,
      });
      setLoading(false);
      onSubmit();
      return;
    }

    try {
      const formattedData = new FormData();
      formattedData.append("userData", JSON.stringify(userData));
      formattedData.append("changes", JSON.stringify(changes));
      formattedData.append("tramite_id", tramite_id);
      formattedData.append("client_id", formData.client.id);
      formattedData.append("signer_id", formData.signer.id);
      formattedData.append(
        "contract_ids",
        JSON.stringify(formData.contracts.map((c) => c.id))
      );
      uploadedFiles.forEach((file) => {
        formattedData.append("files", file);
      });

      const res = await fetch(`/api/tramites/update`, {
        method: "POST",

        body: formattedData,
      });
      const { success, error } = await res.json();

      if (!success) {
        showCustomToast({
          title: "Error al actualizar trámite",
          message: error,
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: CircleX,
        });
        return;
      }

      const notification: Notification = generateTramiteUpdatedNotification(
        changes,
        uploadedFiles,
        tramite_id,
        formData.tramite.user_id
      );
      const response = await fetch(`/api/notifications/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notification }), // Enviar la notificación correctamente
      });
      const { success: NotificationSuccess, error: NotificationError } =
        await response.json();

      if (!NotificationSuccess && NotificationError) {
        showCustomToast({
          title: "Error al notificar cambios",
          message: NotificationError,
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: CircleX,
        });
        return;
      }

      showCustomToast({
        title: `Trámite ${tramite_id} actualizado`,
        message: `Se ha notificado a ${formData.tramite.sales_name}`,
        iconColor: "var(--success-color)",
        iconSize: 24,
        icon: CheckCircle,
      });
      onSubmit();
      refreshTramites();
    } catch (error) {
      console.error("Error al actualizar trámite:", error);
      showCustomToast({
        title: "Error al actualizar trámite",
        message: "Inténtalo de nuevo más tarde",
        iconColor: "var(--danger-color)",
        iconSize: 24,
        icon: CircleX,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (!checkChanges()) {
      onCancel();
      return;
    }
  };

  return (
    <>
      {loading && (
        <div className="absolute top-0 left-0 w-full h-full flex justify-center items-end bg-white bg-opacity-15 z-50">
          <Spinner
            size="lg"
            label="Creando trámite..."
            color="primary"
            className="text-lg mb-96"
          />
        </div>
      )}
      <div className={`flex flex-col gap-4 ${loading && "blur-sm"}`}>
        <h1 className="text-2xl text-[var(--primary-color-500)] font-bold ">
          {formData.tramite.id}
        </h1>
        <TramiteForm
          tramite={formData.tramite}
          setFormData={setFormData}
          userData={userData as User}
          loading={loading}
        />
        <Divider className="bg-[var(--primary-color-300)]" />
        <div className="grid grid-cols-2 gap-4">
          <EditClientForm
            client={formData.client}
            setFormData={setFormData}
            signer={formData.signer}
            userData={userData as User}
          />
        </div>
        <Divider className="bg-[var(--primary-color-300)]" />
        <EditFormWrapper title="Contratos">
          <div className="flex items-start gap-4 w-full">
            {checkRole() && (
              <CreateContractDrawer
                tramite_id={tramite_id}
                onCreateContract={handleCreateContract}
              />
            )}
            {formData.contracts.length === 0 ? (
              <div className="flex flex-col items-center justify-center w-full h-12">
                <p className="text-gray-500 text-base">No hay contratos</p>
              </div>
            ) : (
              <>
                {formData.contracts.map((contract, index) => (
                  <ContractPreview
                    userData={userData as User}
                    key={index}
                    contract={contract}
                    onSavingContract={handleUpdateContract}
                    tramite={formData.tramite}
                  />
                ))}
              </>
            )}
          </div>
        </EditFormWrapper>
        <Divider className="bg-[var(--primary-color-300)]" />
        <EditTramiteFiles
          userData={userData as User}
          files={formData.files}
          uploadedFiles={uploadedFiles}
          setUploadedFiles={setUploadedFiles}
        />
        <Divider className="bg-[var(--primary-color-300)]" />
        <NotesBoard
          notes={formData.tramite.notes as string[]}
          onCreateNote={handleUpdateNotes}
        />
        <Divider className="bg-[var(--primary-color-300)]" />

        <div className="w-full flex items-center justify-between">
          {checkChanges() ? (
            <CancelEditTramiteConfirmationModal onCancel={onCancel} />
          ) : (
            <Button
              onPress={handleCancel}
              variant="ghost"
              color="danger"
              radius="sm"
            >
              Cancelar
            </Button>
          )}
          <Button
            onPress={handleSubmit}
            variant="ghost"
            color="primary"
            radius="sm"
          >
            Guardar
          </Button>
        </div>
      </div>
    </>
  );
}
