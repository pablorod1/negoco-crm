"use client";
import { useState } from "react";
import { useTramites } from "@/lib/contexts/TramitesContext";

import FirstStepForm from "./forms/firstStepForm/FirstStepForm";
import {
  ClientDB,
  ComparativaFile,
  ComparativaVM,
  ContractDB,
  createEmptyClientDB,
  createEmptyTramiteDB,
  SignerDB,
  TramiteDB,
  User,
} from "@/lib/core/types";

import SecondStepForm from "../createTramite/forms/SecondStepForm";
import ThirdStepForm from "../createTramite/forms/ThirdStepForm";
import { CreateTramiteStepper } from "../CreateTramiteStepper";
import FourthStepForm from "../createTramite/forms/FourthStepForm";

import {
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  useDisclosure,
} from "@heroui/modal";
import { CheckCircle, CircleX, FilePlus2, PlusCircle } from "lucide-react";
import { useUser } from "@/lib/contexts/UserContext";
import { Button } from "@heroui/button";
import { showCustomToast } from "../../core/CustomToast";
import { ButtonProps } from "@heroui/button";

export type UploadStatus = {
  progress: number;
  currentStep: string;
  filesTotal: number;
  filesUploaded: number;
  status: "idle" | "uploading" | "processing" | "success" | "error";
  error?: string;
};

export default function AddTramiteDialog({
  shortcut,
  color,
  comparativa,
  plan,
  onComparativaUpdated,
}: {
  shortcut?: boolean;
  color?: ButtonProps["color"];
  comparativa?: ComparativaVM;
  plan?: string;
  onComparativaUpdated?: () => void;
}) {
  const { userData } = useUser();
  const [activeTab, setActiveTab] = useState(0);
  const [tramite, setTramite] = useState<TramiteDB>(
    createEmptyTramiteDB(
      userData as User,
      plan ? (plan as "fijo" | "indexado") : undefined,
      comparativa ? comparativa : undefined
    )
  );
  const [client, setClient] = useState<ClientDB>(
    createEmptyClientDB(comparativa ? comparativa : undefined)
  );
  const [signer, setSigner] = useState<SignerDB | null>(null);
  const [contracts, setContracts] = useState<ContractDB[]>([]);
  const [documents, setDocuments] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({
    progress: 0,
    currentStep: "Preparando subida",
    filesTotal: 0,
    filesUploaded: 0,
    status: "idle",
  });

  const { isOpen, onClose, onOpen } = useDisclosure();
  const { refreshTramites } = useTramites();

  const comparativaFiles = comparativa
    ? (comparativa.files as ComparativaFile[])
    : undefined;

  const handleOpen = () => {
    onOpen();
    setActiveTab(0);
    setTramite(
      createEmptyTramiteDB(
        userData as User,
        plan as "fijo" | "indexado",
        comparativa
      )
    );
    setClient(createEmptyClientDB(comparativa ? comparativa : undefined));
    setSigner(null);
    setContracts([]);
    setDocuments([]);
    setUploadStatus({
      progress: 0,
      currentStep: "Preparando subida",
      filesTotal: 0,
      filesUploaded: 0,
      status: "idle",
    });
  };

  const handleBack = () => {
    setActiveTab(() => activeTab - 1);
  };

  const handleNext = () => {
    if (activeTab === 3) {
      addIds();
    }

    if (activeTab === 0) {
      console.log("Signer", signer);
    }

    setActiveTab(() => activeTab + 1);
  };

  const addIds = () => {
    contracts.forEach((contract) => {
      contract.tramite_id = tramite.id;
    });
  };

  const handleSubmit = async () => {
    setLoading(true);

    // Inicializar estado de carga
    setUploadStatus({
      progress: 0,
      currentStep: "Preparando archivos",
      filesTotal: documents.length + (comparativaFiles?.length || 0),
      filesUploaded: 0,
      status: "uploading",
    });

    try {
      const formData = new FormData();

      // Configurar el objeto XMLHttpRequest para seguir el progreso
      const xhr = new XMLHttpRequest();

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round(
            (event.loaded / event.total) * 100
          );
          setUploadStatus((prev) => ({
            ...prev,
            progress: percentComplete,
            currentStep: `Subiendo archivos (${percentComplete}%)`,
            status: "uploading",
          }));
        }
      };

      xhr.onload = async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const { success, error } = JSON.parse(xhr.responseText);

            if (!success) {
              setUploadStatus((prev) => ({
                ...prev,
                status: "error",
                error: error || "Error desconocido",
              }));
              showCustomToast({
                title: "Error al añadir trámite",
                message: error || "Error desconocido",
                iconColor: "var(--danger-color)",
                iconSize: 24,
                icon: CircleX,
              });
              setLoading(false);
              return;
            }

            setUploadStatus((prev) => ({
              ...prev,
              progress: 70,
              currentStep: "Trámite registrado, finalizando proceso",
              status: "processing",
            }));

            showCustomToast({
              title: "Trámite añadido",
              message: "El trámite ha sido añadido correctamente",
              iconColor: "var(--success-color)",
              iconSize: 24,
              icon: CheckCircle,
            });

            // Procesar comparativa si existe
            if (comparativa) {
              setUploadStatus((prev) => ({
                ...prev,
                progress: 80,
                currentStep: "Actualizando comparativa",
                status: "processing",
              }));

              const comparativaRes = await fetch(
                "/api/comparativas/update/status",
                {
                  method: "PATCH",
                  body: JSON.stringify({
                    id: comparativa.id,
                    status: "processed",
                    tramite_id: tramite.id,
                  }),
                  headers: {
                    "Content-Type": "application/json",
                  },
                }
              );

              const { success: comparativaSuccess, error: comparativaError } =
                await comparativaRes.json();

              if (!comparativaSuccess) {
                setUploadStatus((prev) => ({
                  ...prev,
                  status: "error",
                  error: comparativaError || "Error al actualizar comparativa",
                }));
                showCustomToast({
                  title: "Error al actualizar comparativa",
                  message: comparativaError || "Error desconocido",
                  iconColor: "var(--danger-color)",
                  iconSize: 24,
                  icon: CircleX,
                });
                setLoading(false);
                return;
              }

              setUploadStatus((prev) => ({
                ...prev,
                progress: 90,
                currentStep: "Moviendo archivos de la comparativa",
                status: "processing",
              }));

              const moveFileRes = await fetch("/api/comparativas/move-files", {
                method: "POST",
                body: JSON.stringify({
                  organization_id: userData?.organization.id,
                  comparativa_id: comparativa.id,
                  tramite_id: tramite.id,
                }),
                headers: {
                  "Content-Type": "application/json",
                },
              });

              const { success: moveFilesSuccess, error: moveFileError } =
                await moveFileRes.json();

              if (!moveFilesSuccess) {
                setUploadStatus((prev) => ({
                  ...prev,
                  status: "error",
                  error: moveFileError || "Error al mover archivos",
                }));
                showCustomToast({
                  title: "Error al mover archivos",
                  message: moveFileError || "Error desconocido",
                  iconColor: "var(--danger-color)",
                  iconSize: 24,
                  icon: CircleX,
                });
                setLoading(false);
                return;
              }

              showCustomToast({
                title: "Comparativa actualizada",
                message: "La comparativa ha sido actualizada correctamente",
                iconColor: "var(--success-color)",
                iconSize: 24,
                icon: CheckCircle,
              });

              if (onComparativaUpdated) {
                onComparativaUpdated();
              }
            }

            // Todo correcto - finalizar
            setUploadStatus((prev) => ({
              ...prev,
              progress: 100,
              currentStep: "¡Trámite creado con éxito!",
              status: "success",
            }));

            // Delay para mostrar el mensaje de éxito antes de cerrar
            setTimeout(() => {
              refreshTramites();
              onClose();
              setLoading(false);
            }, 1000);
          } catch (parseError) {
            setUploadStatus((prev) => ({
              ...prev,
              status: "error",
              error: "Error al procesar la respuesta del servidor",
            }));
            console.error("Error parsing response:", parseError);
            setLoading(false);
          }
        } else {
          setUploadStatus((prev) => ({
            ...prev,
            status: "error",
            error: `Error del servidor: ${xhr.status}`,
          }));
          setLoading(false);
        }
      };

      xhr.onerror = () => {
        setUploadStatus((prev) => ({
          ...prev,
          status: "error",
          error: "Error de conexión",
        }));
        setLoading(false);
      };

      // Append files first
      documents.forEach((doc) => {
        formData.append("files", doc);
      });

      // Append JSONs
      formData.append("userData", JSON.stringify(userData));
      formData.append("client", JSON.stringify(client));
      formData.append("tramite", JSON.stringify(tramite));

      // Optional fields
      if (signer) {
        formData.append("signer", JSON.stringify(signer));
      }
      if (contracts.length > 0) {
        formData.append("contracts", JSON.stringify(contracts));
      }

      // Iniciar la petición
      xhr.open("POST", "/api/tramites/add");
      xhr.send(formData);
    } catch (error) {
      console.error("Submission error:", error);
      setUploadStatus((prev) => ({
        ...prev,
        status: "error",
        error: error instanceof Error ? error.message : "Error desconocido",
      }));
      showCustomToast({
        title: "Error de Conexión",
        message: error instanceof Error ? error.message : "Error desconocido",
        iconColor: "var(--danger-color)",
        iconSize: 24,
        icon: CircleX,
      });
      setLoading(false);
    }
  };

  const formElements = [
    <FirstStepForm
      key={1}
      setClient={setClient}
      setTramite={setTramite}
      onSubmitSuccess={handleNext}
      tramite={tramite}
      onCancel={onClose}
      client={client}
      setSigner={setSigner}
    />,
    <SecondStepForm
      key={2}
      client={client}
      setClient={setClient}
      setSigner={setSigner}
      onSecondSubmitSuccess={handleNext}
      onBack={handleBack}
      onCancel={onClose}
      signer={signer}
    />,
    <ThirdStepForm
      key={3}
      onBack={handleBack}
      onSubmit={handleNext}
      tramite={tramite}
      setTramite={setTramite}
      onCancel={onClose}
      contracts={contracts}
      setContracts={setContracts}
      userData={userData as User}
    />,
    <FourthStepForm
      key={4}
      onBack={handleBack}
      onFinish={handleSubmit}
      tramite={tramite}
      setTramite={setTramite}
      onCancel={onClose}
      documents={documents}
      setDocuments={setDocuments}
      loading={loading}
      uploadStatus={uploadStatus}
      comparativaFiles={comparativaFiles ? comparativaFiles : undefined}
    />,
  ];

  return (
    <>
      {!shortcut ? (
        <Button
          onPress={handleOpen}
          color={color ? color : "primary"}
          radius="sm"
          className="shadow-md"
        >
          <PlusCircle size={20} />
          <span>Nuevo Trámite</span>
        </Button>
      ) : (
        <div onClick={handleOpen} className="flex flex-col items-center gap-2">
          <FilePlus2 size={24} />
          <span className="text-nowrap">Nuevo trámite</span>
        </div>
      )}

      <Modal
        isDismissable={false}
        radius="sm"
        hideCloseButton
        inert={!isOpen}
        isOpen={isOpen}
        onClose={onClose}
        classNames={{
          wrapper: "overflow-hidden",
          base: "max-h-[90vh] overflow-y-auto",
        }}
      >
        <ModalContent
          className={`transition-all duration-700 ease-in-out w-full h-auto ${
            activeTab === 1 || activeTab === 3
              ? "max-w-[1400px]"
              : activeTab === 2
                ? "max-w-[1200px]"
                : "max-w-[800px]"
          }`}
        >
          <ModalHeader className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm flex items-center justify-between p-4">
            <CreateTramiteStepper steps={4} currentStep={activeTab} />
          </ModalHeader>
          <ModalBody>{formElements[activeTab]}</ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
