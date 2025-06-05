"use client";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { VariantProps } from "class-variance-authority";
import { CheckCircle, CircleX, Plus, Sun } from "lucide-react";
import { useState } from "react";
import { CreateFotovoltaicaStepper } from "./CreateFotovoltaicaStepper";
import {
  createEmptyFotovoltaicaDB,
  FotovoltaicaDB,
  FotovoltaicaFile,
  User,
} from "@/lib/core/types";
import { useUser } from "@/lib/contexts/UserContext";
import FirstStepFotovoltaicaForm from "./forms/FirstStepFotovoltaicaForm";
import SecondStepFotovoltaicaForm from "./forms/SecondStepFotovoltaicaForm";
import ThirdStepFotovoltaicaForm from "./forms/ThirdStepFotovoltaicaForm";
import FourthStepFotovoltaicaForm from "./forms/FourthStepFotovoltaicaForm";
import { cn } from "@/lib/utils";
import { uploadFile } from "@/lib/firebase/data/uploadFiles";
import { showCustomToast } from "@/components/core/CustomToast";
import { useFotovoltaicas } from "@/lib/contexts/FotovoltaicasContext";

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
      const fotovoltaicaFiles: FotovoltaicaFile[] = [];

      for (const file of uploadedFiles) {
        try {
          const { downloadURL, previewURL } = await uploadFile(
            file,
            `${userData?.organization.id}/fotovoltaicas`,
            formData.id
          );

          fotovoltaicaFiles.push({
            id: crypto.randomUUID(),
            fotovoltaica_id: formData.id,
            filename: file.name,
            size: file.size,
            extension: file.name.split(".").pop() || "",
            upload_date: new Date().toISOString(),
            download_url: downloadURL,
            preview_url: previewURL || null,
          });
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

      const fotovoltaicaData = new FormData();
      fotovoltaicaData.append("fotovoltaica", JSON.stringify(formData));
      fotovoltaicaData.append("files", JSON.stringify(fotovoltaicaFiles));

      const response = await fetch(`/api/fotovoltaica/add`, {
        method: "POST",
        body: fotovoltaicaData,
      });

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
        return;
      }

      const { success, error } = await response.json();

      if (!success) {
        showCustomToast({
          title: "Error al enviar la solicitud",
          message: error,
          icon: CircleX,
          iconColor: "var(--danger-color)",
          iconSize: 24,
        });
        return;
      }

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
    <Dialog open={isOpen} onOpenChange={onOpen}>
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
          <button
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
        {formElements[activeTab]}
      </DialogContent>
    </Dialog>
  );
}
