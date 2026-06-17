"use client";
import { Button, buttonVariants } from "@/core/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/core/components/ui/dialog";
import { VariantProps } from "class-variance-authority";
import { CheckCircle, CircleX, Plus, Sun } from "lucide-react";
import { useState } from "react";
import { CreateFotovoltaicaStepper } from "./CreateFotovoltaicaStepper";
import { FotovoltaicaDB, FotovoltaicaFile } from "@/fotovoltaica/types";
import { createEmptyFotovoltaicaDB } from "@/fotovoltaica/utils/fotovoltaica.factories";
import { User } from "@/core/types";
import { useUser } from "@/core/contexts/UserContext";
import FirstStepFotovoltaicaForm from "./forms/FirstStepFotovoltaicaForm";
import SecondStepFotovoltaicaForm from "./forms/SecondStepFotovoltaicaForm";
import ThirdStepFotovoltaicaForm from "./forms/ThirdStepFotovoltaicaForm";
import FourthStepFotovoltaicaForm from "./forms/FourthStepFotovoltaicaForm";
import { cn } from "@/core/utils";
import { uploadFile } from "@/core/firebase/data/uploadFiles";
import { showCustomToast } from "@/core/components/CustomToast";
import { useFotovoltaicas } from "@/core/contexts/FotovoltaicasContext";
import {
  FotovoltaicaFileSchema,
  FotovoltaicaSchema,
} from "@/fotovoltaica/schemas";
import LoadingStateModal from "@/core/components/LoadingStateModal";
import { deleteFiles } from "@/core/firebase/data/deleteFile";

export default function AddFotovoltaicaDialog({
  variant,
  shortcut = false,
}: {
  variant?: string;
  shortcut?: boolean;
}) {
  const { userData } = useUser();
  const { refreshFotovoltaicas } = useFotovoltaicas();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [formData, setFormData] = useState<FotovoltaicaDB>(
    createEmptyFotovoltaicaDB(userData as User)
  );
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<number>(0);
  const [loadingMessage, setLoadingMessage] = useState<string>("");

  const handleBack = () => setActiveTab((prev) => Math.max(prev - 1, 0));
  const handleNext = () => setActiveTab((prev) => Math.min(prev + 1, 3));
  const onClose = () => {
    setIsOpen(false);
    setActiveTab(0);
    setFormData(createEmptyFotovoltaicaDB(userData as User));
    setUploadedFiles([]);
  };
  const onOpen = () => {
    setIsOpen(true);
    setActiveTab(0);
    setFormData(createEmptyFotovoltaicaDB(userData as User));
    setUploadedFiles([]);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Step 1: Validate data
      setLoadingStep(1);
      setLoadingMessage("Validando datos");
      try {
        FotovoltaicaSchema.parse(formData);
      } catch {
        showCustomToast({
          title: "Datos inválidos",
          message:
            "Revisa el cliente y el enlace de la ubicación. Deben ser válidos.",
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: CircleX,
        });
        return;
      }

      const fotovoltaicaFiles: FotovoltaicaFile[] = [];

      // Step 2: Upload files
      setLoadingStep(2);
      setLoadingMessage("Subiendo archivos");
      const uploadedFilePaths: string[] = [];
      for (const file of uploadedFiles) {
        try {
          const { downloadURL, previewURL, file_path } = await uploadFile(
            file,
            `${userData?.organization.id}/fotovoltaicas`,
            formData.id
          );
          if (file_path) uploadedFilePaths.push(file_path);

          const filePayload: FotovoltaicaFile = {
            id: crypto.randomUUID(),
            fotovoltaica_id: formData.id,
            filename: file.name,
            size: file.size,
            extension: file.name.split(".").pop() || "",
            upload_date: new Date().toISOString(),
            download_url: downloadURL,
            preview_url: previewURL || null,
          };

          // Validate each file payload (defensive)
          try {
            FotovoltaicaFileSchema.parse(filePayload);
          } catch {
            showCustomToast({
              title: "Archivo inválido",
              message: `El archivo ${file.name} no es válido`,
              iconColor: "var(--danger-color)",
              iconSize: 24,
              icon: CircleX,
            });
            return;
          }

          fotovoltaicaFiles.push(filePayload);
        } catch (error) {
          showCustomToast({
            title: "Error al subir el archivo",
            message: "Inténtalo de nuevo más tarde",
            iconColor: "var(--danger-color)",
            iconSize: 24,
            icon: CircleX,
          });
          console.error("Error uploading file:", error);
          return;
        }
      }

      // Step 3: Prepare request
      setLoadingStep(3);
      setLoadingMessage("Preparando solicitud");
      const fotovoltaicaData = new FormData();
      fotovoltaicaData.append("fotovoltaica", JSON.stringify(formData));
      fotovoltaicaData.append("files", JSON.stringify(fotovoltaicaFiles));

      // Step 4: Submit (transactional on server)
      setLoadingStep(4);
      setLoadingMessage("Creando solicitud");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      const response = await fetch(`/api/v2/solar-installations`, {
        method: "PUT",
        body: fotovoltaicaData,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const errorData = await response.json();
        showCustomToast({
          title: "Error al enviar la solicitud",
          message: errorData.error || "Inténtalo de nuevo más tarde",
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: CircleX,
        });
        console.error("Error submitting fotovoltaica:", errorData);
        try {
          if (uploadedFilePaths.length > 0)
            await deleteFiles(uploadedFilePaths);
        } catch (e) {
          console.warn(
            "No se pudieron eliminar los archivos subidos tras el fallo",
            e
          );
        }
        return;
      }

      const { success, error } = await response.json();

      if (!success) {
        showCustomToast({
          title: "Error al enviar la solicitud",
          message:
            typeof error === "string" ? error : "No se pudo crear la solicitud",
          icon: CircleX,
          iconColor: "var(--danger-color)",
          iconSize: 24,
        });
        try {
          if (uploadedFilePaths.length > 0)
            await deleteFiles(uploadedFilePaths);
        } catch (e) {
          console.warn(
            "No se pudieron eliminar los archivos subidos tras el fallo",
            e
          );
        }
        return;
      }

      setLoadingStep(5);
      setLoadingMessage("Finalizando trámite");
      showCustomToast({
        title: "Solicitud Placas Solares Enviada",
        message: "La solicitud ha sido enviada correctamente",
        iconColor: "var(--success-color)",
        iconSize: 24,
        icon: CheckCircle,
        buttonLink: `/fotovoltaica/${formData.id}`,
        buttonLinkText: "Ver Solicitud",
      });
      refreshFotovoltaicas();
      onClose();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        showCustomToast({
          title: "Tiempo de espera excedido",
          message: "El servidor tardó demasiado en responder.",
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: CircleX,
        });
        return;
      }
      showCustomToast({
        title: "Error al crear la solicitud",
        message: "Inténtalo de nuevo más tarde",
        iconColor: "var(--danger-color)",
        iconSize: 24,
        icon: CircleX,
      });
      console.error("Error al crear la solicitud:", error);
    } finally {
      setLoading(false);
      setLoadingStep(0);
      setLoadingMessage("");
    }
  };

  const formElements = [
    // Replace with your actual form components
    <FirstStepFotovoltaicaForm
      key={0}
      formData={formData}
      setFormData={setFormData}
      onCancel={onClose}
      onSubmit={handleNext}
    />,
    <SecondStepFotovoltaicaForm
      key={1}
      formData={formData}
      setFormData={setFormData}
      onSubmit={handleNext}
      onBack={handleBack}
      onCancel={onClose}
    />,
    <ThirdStepFotovoltaicaForm
      key={2}
      uploadedFiles={uploadedFiles}
      setUploadedFiles={setUploadedFiles}
      onBack={handleBack}
      onSubmit={handleNext}
      onCancel={onClose}
    />,
    <FourthStepFotovoltaicaForm
      key={3}
      formData={formData}
      setFormData={setFormData}
      onSubmit={handleSubmit}
      onBack={handleBack}
      onCancel={onClose}
      userData={userData as User}
      loading={loading}
    />,
  ];
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => (open ? onOpen() : onClose())}
    >
      <DialogTrigger asChild>
        {!shortcut ? (
          <Button
            variant={
              variant
                ? (variant as VariantProps<typeof buttonVariants>["variant"])
                : "default"
            }
            onClick={() => setIsOpen(true)}
          >
            <Plus size={20} />
            <span>Solicita Estudio Placas Solares</span>
          </Button>
        ) : (
          <button type="button"
            onClick={onOpen}
            className="group cursor-pointer w-full flex items-start gap-3 p-3 rounded-lg transition-all duration-200 hover:bg-orange-50 hover:shadow-sm border border-transparent hover:border-orange-200"
          >
            <div className="p-2 rounded-md bg-orange-50 group-hover:bg-orange-100 text-orange-600 transition-colors duration-200">
              <Sun className="w-4 h-4" />
            </div>
            <div className="flex-1 text-left">
              <h5 className="font-medium text-sm text-gray-900">
                Solicitar Estudio Placas Solares
              </h5>
              <p className="text-xs text-gray-600">
                Solicita tu estudio de placas solares
              </p>
            </div>
          </button>
        )}
      </DialogTrigger>
      <DialogContent
        className={cn(
          "transition-all duration-700 ease-in-out w-full h-auto max-w-[1200px] [&>button]:hidden",
          activeTab === 3 ? "max-w-[1200px]" : "max-w-[900px]",
          "max-h-[90vh] overflow-y-auto"
        )}
      >
        <DialogHeader className="mb-6">
          <div className="hidden">
            <DialogTitle className="text-lg text-primary-800 font-semibold">
              Solicitud Estudio Placas Solares
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500 mb-4">
              Completa los pasos para solicitar un estudio de placas solares.
            </DialogDescription>
          </div>
          <CreateFotovoltaicaStepper steps={4} currentStep={activeTab} />
        </DialogHeader>
        {loading ? (
          <LoadingStateModal
            title={
              loadingStep <= 1
                ? "Validando datos"
                : loadingStep === 2
                  ? "Subiendo archivos"
                  : loadingStep === 3
                    ? "Preparando solicitud"
                    : loadingStep === 4
                      ? "Creando solicitud"
                      : "Finalizando trámite"
            }
            description={loadingMessage || "Por favor, espera..."}
          />
        ) : null}
        {formElements[activeTab]}
      </DialogContent>
    </Dialog>
  );
}
