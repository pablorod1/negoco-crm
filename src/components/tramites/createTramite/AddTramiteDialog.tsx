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
  TramiteFile,
  User,
} from "@/lib/core/types";

import SecondStepForm from "./forms/secondStepForm/SecondStepForm";
import ThirdStepForm from "../createTramite/forms/ThirdStepForm";
import { CreateTramiteStepper } from "../CreateTramiteStepper";
import FourthStepForm from "../createTramite/forms/FourthStepForm";

import { CheckCircle, CircleX, PlusCircle } from "lucide-react";
import { useUser } from "@/lib/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { showCustomToast } from "../../core/CustomToast";
import { uploadFile } from "@/lib/firebase/data/uploadFiles";
import { deleteFiles } from "@/lib/firebase/data/deleteFile";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogTrigger } from "@radix-ui/react-dialog";
import { VariantProps } from "class-variance-authority";
import { buttonVariants } from "@/components/ui/button";
import ReviewStep from "./forms/ReviewStep";

export default function AddTramiteDialog({
  variant,
  comparativa,
  plan,
  onComparativaUpdated,
}: {
  variant?: string;
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
  const [isOpen, setIsOpen] = useState(false);
  const { refreshTramites } = useTramites();

  const comparativaFiles = comparativa
    ? (comparativa.files as ComparativaFile[])
    : undefined;

  const handleOpen = () => {
    setIsOpen(true);
    setActiveTab(0);
    setTramite(
      createEmptyTramiteDB(
        userData as User,
        plan ? (plan as "fijo" | "indexado") : undefined,
        comparativa ? comparativa : undefined
      )
    );
    setClient(createEmptyClientDB(comparativa ? comparativa : undefined));
    setSigner(null);
    setContracts([]);
    setDocuments([]);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleBack = () => {
    setActiveTab(() => activeTab - 1);
  };

  const handleNext = () => {
    setActiveTab((prev) => prev + 1);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const uploadedFilePaths: string[] = [];
      const tramiteFiles: TramiteFile[] = await Promise.all(
        documents.map(async (file) => {
          const { downloadURL, previewURL, file_path } = await uploadFile(
            file,
            `${userData?.organization.id}/tramites`,
            tramite.id
          );

          uploadedFilePaths.push(file_path as string);

          return {
            id: crypto.randomUUID(),
            tramite_id: tramite.id,
            filename: file.name,
            size: file.size,
            extension: file.name.split(".").pop() || "",
            upload_date: new Date().toISOString(),
            download_url: downloadURL,
            preview_url: previewURL || null,
          };
        })
      );

      const formData = new FormData();

      // Append files first
      formData.append("files", JSON.stringify(tramiteFiles));
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

      const res = await fetch("/api/tramites/add", {
        method: "POST",
        body: formData, // Directly use FormData
      });

      const { success, error } = await res.json();

      if (!success) {
        showCustomToast({
          title: "Error al añadir trámite",
          message: error || "Error desconocido",
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: CircleX,
        });
        await deleteFiles(uploadedFilePaths);
        return;
      }

      showCustomToast({
        title: "Trámite añadido",
        message: "El trámite ha sido añadido correctamente",
        iconColor: "var(--success-color)",
        iconSize: 24,
        icon: CheckCircle,
      });

      if (comparativa) {
        const comparativaRes = await fetch("/api/comparativas/update/status", {
          method: "PATCH",
          body: JSON.stringify({
            id: comparativa.id,
            status: "processed",
            tramite_id: tramite.id,
          }),
          headers: {
            "Content-Type": "application/json",
          },
        });

        const { success: comparativaSuccess, error: comparativaError } =
          await comparativaRes.json();

        if (!comparativaSuccess) {
          showCustomToast({
            title: "Error al actualizar comparativa",
            message: comparativaError || "Error desconocido",
            iconColor: "var(--danger-color)",
            iconSize: 24,
            icon: CircleX,
          });
          return;
        }

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
          showCustomToast({
            title: "Error al mover archivos",
            message: moveFileError || "Error desconocido",
            iconColor: "var(--danger-color)",
            iconSize: 24,
            icon: CircleX,
          });
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
          handleClose();
        }
      }

      localStorage.removeItem("signer");
      localStorage.removeItem("client");

      try {
        await refreshTramites();
        handleClose();
      } catch (error) {
        console.error("Error al refrescar los trámites:", error);
        showCustomToast({
          title: "Error al refrescar los trámites",
          message: "Inténtalo de nuevo más tarde",
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: CircleX,
        });
        handleClose();
      }
    } catch (error) {
      console.error("Submission error:", error);
      showCustomToast({
        title: "Error de Conexión",
        message: error as string,
        iconColor: "var(--danger-color)",
        iconSize: 24,
        icon: CircleX,
      });
    } finally {
      setLoading(false);
    }
  };
  const formElements = [
    <FirstStepForm
      key={1}
      setTramite={setTramite}
      onSubmitSuccess={handleNext}
      tramite={tramite}
      onCancel={handleClose}
    />,
    <SecondStepForm
      key={2}
      client={client}
      setClient={setClient}
      onSecondSubmitSuccess={handleNext}
      onBack={handleBack}
      onCancel={handleClose}
      setSigner={setSigner}
      signer={signer as SignerDB}
      userData={userData as User}
      setTramite={setTramite}
    />,
    <ThirdStepForm
      key={3}
      onBack={handleBack}
      onSubmit={handleNext}
      tramite={tramite}
      setTramite={setTramite}
      onCancel={handleClose}
      contracts={contracts}
      setContracts={setContracts}
      userData={userData as User}
    />,
    <FourthStepForm
      userData={userData as User}
      key={4}
      onBack={handleBack}
      onFinish={handleNext}
      tramite={tramite}
      setTramite={setTramite}
      onCancel={handleClose}
      documents={documents}
      setDocuments={setDocuments}
      loading={loading}
      comparativaFiles={comparativaFiles ? comparativaFiles : undefined}
    />,
    <ReviewStep
      key={5}
      tramite={tramite}
      client={client}
      signer={signer}
      contracts={contracts}
      documents={documents}
      onBack={handleBack}
      onSubmit={handleSubmit}
      onCancel={handleClose}
      loading={loading}
      userData={userData as User}
    />,
  ];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          onClick={handleOpen}
          variant={
            variant
              ? (variant as VariantProps<typeof buttonVariants>["variant"])
              : "default"
          }
        >
          <PlusCircle size={20} />
          <span>Nuevo Trámite</span>
        </Button>
      </DialogTrigger>

      <DialogContent
        onInteractOutside={(e) => {
          e.preventDefault();
        }}
        className={`transition-all duration-700 ease-in-out w-full h-auto ${
          activeTab === 0
            ? "max-w-[1200px]"
            : activeTab === 1
              ? "max-w-[1400px]"
              : activeTab === 2
                ? "max-w-[1300px]"
                : "max-w-[1400px]"
        }`}
      >
        <DialogHeader>
          <div className="hidden">
            <DialogTitle className="text-lg text-primary-800 font-semibold">
              Creando una nueva comparativa
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500 mb-4">
              Completa los pasos para crear una nueva comparativa
            </DialogDescription>
          </div>
          <CreateTramiteStepper
            steps={5}
            currentStep={activeTab}
            selectedComercial={
              {
                id: tramite.user_id,
                name: tramite.sales_name,
              } as User
            }
            selectedClient={{
              id: client.id,
              name: client.name,
              last_name: client.last_name,
              type: client.type,
              document_type: client.document_type,
              document_number: client.document_number,
            }}
            setActiveStep={setActiveTab}
          />
        </DialogHeader>
        {formElements[activeTab]}
      </DialogContent>
    </Dialog>
  );
}
