"use client";
import { useState, useCallback } from "react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { VariantProps } from "class-variance-authority";
import { buttonVariants } from "@/components/ui/button";
import ReviewStep from "./forms/ReviewStep";
import ComparativaToTramiteStep from "./forms/ComparativaToTramiteStep";

interface AddTramiteDialogProps {
  variant?: string;
  comparativa?: ComparativaVM;
  onComparativaUpdated?: () => void;
  savedClient?: ClientDB;
}

export default function AddTramiteDialog({
  variant,
  comparativa,
  onComparativaUpdated,
  savedClient,
}: AddTramiteDialogProps) {
  // State management
  const [plan, setPlan] = useState<"fijo" | "indexado" | undefined>(
    comparativa ? comparativa.plan[0] : undefined
  );
  const { userData } = useUser();
  const [activeTab, setActiveTab] = useState<number>(0);
  const [tramite, setTramite] = useState<TramiteDB>({} as TramiteDB);
  const [client, setClient] = useState<ClientDB>({} as ClientDB);
  const [signer, setSigner] = useState<SignerDB | null>(null);
  const [contracts, setContracts] = useState<ContractDB[]>([]);
  const [documents, setDocuments] = useState<File[]>([]);
  const [selectedExistingFiles, setSelectedExistingFiles] = useState<
    TramiteFile[] | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { refreshTramites } = useTramites();

  const comparativaFiles = comparativa
    ? (comparativa.files as ComparativaFile[])
    : undefined;

  // Dialog handlers
  const handleOpen = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsOpen(true);
      setActiveTab(comparativa ? 0 : savedClient ? 2 : 1);
      // Reset form state
      setTramite(
        createEmptyTramiteDB(
          userData as User,
          plan ? (plan as "fijo" | "indexado") : undefined,
          comparativa ? comparativa : undefined
        )
      );
      setClient(
        savedClient
          ? savedClient
          : createEmptyClientDB(comparativa ? comparativa : undefined)
      );
      setSigner(null);
      setContracts([]);
      setDocuments([]);
      setSelectedExistingFiles(null);
    },
    [userData, plan, comparativa, savedClient]
  );

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Navigation handlers
  const handleBack = useCallback(() => {
    setActiveTab((prev) => prev - 1);
  }, []);

  const handleNext = useCallback(() => {
    setActiveTab((prev) => prev + 1);
  }, []);

  // Process comparativa update
  const processComparativaUpdate = useCallback(async () => {
    if (!comparativa || !userData) return;

    try {
      // Update comparativa status
      const comparativaRes = await fetch(
        `/api/comparativas/update/${comparativa.id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({
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
        showCustomToast({
          title: "Error al actualizar comparativa",
          message: comparativaError || "Error desconocido",
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: CircleX,
        });
        return false;
      }

      // Move files
      const moveFileRes = await fetch(
        `/api/comparativas/move-files/${comparativa.id}`,
        {
          method: "POST",
          body: JSON.stringify({
            organization_id: userData.organization.id,
            tramite_id: tramite.id,
          }),
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

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
        return false;
      }

      // Send notification email
      const emailRes = await fetch(
        "/api/send-email/comparativa-status-updated",
        {
          method: "POST",
          body: JSON.stringify({
            user_to: {
              email: comparativa.user.email,
              name: comparativa.user.name,
              org_logo: userData.organization.logo,
            },
            comparativa_id: comparativa.id,
            status: { old: "completed", new: "processed" },
            comparativa_name: comparativa.client,
          }),
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const { success: emailSuccess, error: emailError } =
        await emailRes.json();

      if (!emailSuccess) {
        showCustomToast({
          title: "Error al enviar notificación por email",
          message: emailError as string,
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: CircleX,
        });
        return false;
      }

      showCustomToast({
        title: "Comparativa actualizada",
        message: "La comparativa ha sido actualizada correctamente",
        iconColor: "var(--success-color)",
        iconSize: 24,
        icon: CheckCircle,
      });

      return true;
    } catch (error) {
      console.error("Error processing comparativa update:", error);
      return false;
    }
  }, [comparativa, userData, tramite.id]);

  // Form submission
  const handleSubmit = useCallback(async () => {
    setLoading(true);
    try {
      const uploadedFilePaths: string[] = [];

      // Upload new documents
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

      // Prepare form data
      formData.append("files", JSON.stringify(tramiteFiles));
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

      // Handle existing files from comparativa
      if (selectedExistingFiles && selectedExistingFiles.length > 0) {
        const selectedFiles = selectedExistingFiles.map((file) => ({
          id: crypto.randomUUID(),
          tramite_id: tramite.id,
          filename: file.filename,
          size: file.size,
          extension: file.extension,
          upload_date: file.upload_date,
          download_url: file.download_url,
          preview_url: file.preview_url,
        }));

        formData.append("existingFiles", JSON.stringify(selectedFiles));
      }

      // Send request to create tramite
      const res = await fetch("/api/tramites/add", {
        method: "POST",
        body: formData,
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

      // Show success toast
      showCustomToast({
        title: "Trámite añadido",
        message: "El trámite ha sido añadido correctamente",
        iconColor: "var(--success-color)",
        iconSize: 24,
        icon: CheckCircle,
        buttonLinkText: "Ver Trámite",
        buttonLink: `/tramites/${tramite.id}`,
      });

      // Process comparativa update if applicable
      if (comparativa) {
        const updated = await processComparativaUpdate();
        if (updated && onComparativaUpdated) {
          onComparativaUpdated();
          handleClose();
        }
      }

      // Clean up and refresh
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
        message: error instanceof Error ? error.message : String(error),
        iconColor: "var(--danger-color)",
        iconSize: 24,
        icon: CircleX,
      });
    } finally {
      setLoading(false);
    }
  }, [
    userData,
    tramite,
    client,
    signer,
    contracts,
    documents,
    selectedExistingFiles,
    comparativa,
    onComparativaUpdated,
    processComparativaUpdate,
    refreshTramites,
    handleClose,
  ]);

  // Render form elements based on current step
  const renderFormElements = useCallback(() => {
    // Form elements for comparativa flow
    const comparativaFormElements = [
      <ComparativaToTramiteStep
        key={0}
        comparativa={comparativa as ComparativaVM}
        onSubmit={handleNext}
        onCancel={handleClose}
        setPlan={setPlan}
        plan={plan}
        userData={userData as User}
      />,
      <FirstStepForm
        key={1}
        setTramite={setTramite}
        onSubmitSuccess={handleNext}
        tramite={tramite}
        onCancel={handleClose}
        onBack={handleBack}
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
        comparativa={comparativa as ComparativaVM}
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
        client={client}
        selectedExistingFiles={selectedExistingFiles}
        setSelectedExistingFiles={setSelectedExistingFiles}
        userData={userData as User}
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
        selectedExistingFiles={selectedExistingFiles}
      />,
    ];

    // Form elements for normal flow
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
        savedClient={savedClient}
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
        client={client}
        selectedExistingFiles={selectedExistingFiles}
        setSelectedExistingFiles={setSelectedExistingFiles}
        userData={userData as User}
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
        selectedExistingFiles={selectedExistingFiles}
      />,
    ];

    return comparativa
      ? comparativaFormElements[activeTab]
      : formElements[activeTab];
  }, [
    activeTab,
    comparativa,
    handleNext,
    handleBack,
    handleClose,
    tramite,
    client,
    signer,
    contracts,
    documents,
    loading,
    comparativaFiles,
    selectedExistingFiles,
    userData,
    handleSubmit,
    plan,
    savedClient,
    setTramite,
    setClient,
    setSigner,
    setContracts,
    setDocuments,
    setSelectedExistingFiles,
  ]);

  // Get button text based on context
  const getButtonText = useCallback(() => {
    if (comparativa) {
      return <span>Completar Comparativa</span>;
    }

    return (
      <>
        <PlusCircle size={20} />
        <span>Nuevo Trámite</span>
      </>
    );
  }, [comparativa]);

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
          {getButtonText()}
        </Button>
      </DialogTrigger>

      <DialogContent
        onInteractOutside={(e) => {
          e.preventDefault();
        }}
        className="transition-all duration-700 ease-in-out w-full h-auto max-w-[90vw]"
      >
        <DialogHeader>
          <div className="hidden">
            <DialogTitle className="text-lg text-primary-800 font-semibold">
              {comparativa
                ? "Completando Comparativa"
                : "Creando nuevo trámite"}
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500 mb-4">
              Completa los pasos para{" "}
              {comparativa
                ? "completar la comparativa"
                : "crear un nuevo trámite"}
            </DialogDescription>
          </div>
          <CreateTramiteStepper
            steps={comparativa ? 6 : 5}
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
            comparativa={!!comparativa}
          />
        </DialogHeader>
        {renderFormElements()}
      </DialogContent>
    </Dialog>
  );
}
