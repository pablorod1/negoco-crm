"use client";
import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTrigger,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { CheckCircle, CircleX, Plus } from "lucide-react";
import { useUser } from "@/lib/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { CreateComparativaStepper } from "./CreateComparativaStepper";
import {
  ComparativaDB,
  ComparativaFile,
  createEmptyComparativaDB,
  User,
} from "@/lib/core/types";
import FirstStepForm from "./forms/FirstStepForm";
import SecondStepForm from "./forms/SecondStepForm";
import ThirdStepForm from "./forms/ThirdStepForm";
import { showCustomToast } from "@/components/core/CustomToast";
import { useComparativas } from "@/lib/contexts/ComparativasContext";
import { uploadFile } from "@/lib/firebase/data/uploadFiles";
import { type VariantProps } from "class-variance-authority";
import { buttonVariants } from "@/components/ui/button";

export default function AddComparativaDialog({
  variant,
}: {
  variant?: string;
}) {
  const { userData } = useUser();
  const { refreshComparativas } = useComparativas();
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [comparativa, setComparativa] = useState<ComparativaDB>(
    createEmptyComparativaDB(userData as User)
  );
  const [documents, setDocuments] = useState<File[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const onClose = () => {
    setIsOpen(false);
    setActiveTab(0);
    setComparativa(createEmptyComparativaDB(userData as User));
    setDocuments([]);
  };

  const handleBack = () => {
    setActiveTab(() => activeTab - 1);
  };

  const handleNext = () => {
    setActiveTab(() => activeTab + 1);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const comparativaFiles: ComparativaFile[] = [];

      for (const file of documents) {
        try {
          const { downloadURL, previewURL } = await uploadFile(
            file,
            `${userData?.organization.id}/comparativas`,
            comparativa.id
          );

          comparativaFiles.push({
            id: crypto.randomUUID(),
            comparativa_id: comparativa.id,
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
      const formData = new FormData();
      formData.append("comparativa", JSON.stringify(comparativa));
      formData.append("files", JSON.stringify(comparativaFiles));
      const response = await fetch(`/api/comparativas/add`, {
        method: "POST",
        body: formData,
      });

      const { success, error } = await response.json();

      if (!success) {
        showCustomToast({
          title: "Error al crear la comparativa",
          message: error,
          icon: CircleX,
          iconColor: "var(--danger-color)",
          iconSize: 24,
        });
        return;
      }

      showCustomToast({
        title: "Comparativa creada",
        message: "La comparativa ha sido creada correctamente",
        iconColor: "var(--success-color)",
        iconSize: 24,
        icon: CheckCircle,
        buttonLink: `/comparativas/${comparativa.id}`,
        buttonLinkText: "Ver comparativa",
      });
      try {
        await refreshComparativas();
        onClose();
      } catch (error) {
        console.error("Error al refrescar las comparativas:", error);
        showCustomToast({
          title: "Error al refrescar las comparativas",
          message: "Inténtalo de nuevo más tarde",
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: CircleX,
        });
        onClose();
      }
    } catch (error) {
      showCustomToast({
        title: "Error al crear la comparativa",
        message: "Inténtalo de nuevo más tarde",
        iconColor: "var(--danger-color)",
        iconSize: 24,
        icon: CircleX,
      });
      console.error("Error al crear la comparativa:", error);
    } finally {
      setLoading(false);
    }
  };

  const formElements = [
    <FirstStepForm
      key={1}
      userData={userData as User}
      comparativa={comparativa}
      setComparativa={setComparativa}
      onCancel={onClose}
      onNext={handleNext}
    />,
    <SecondStepForm
      key={2}
      documents={documents}
      setDocuments={setDocuments}
      onCancel={handleBack}
      onNext={handleNext}
      onBack={handleBack}
    />,
    <ThirdStepForm
      key={3}
      comparativa={comparativa}
      setComparativa={setComparativa}
      onBack={handleBack}
      onCancel={onClose}
      onSubmit={handleSubmit}
      loading={loading}
    />,
  ];

  return (
    <>
      <Dialog open={isOpen}>
        <DialogTrigger asChild>
          <Button
            variant={
              variant
                ? (variant as VariantProps<typeof buttonVariants>["variant"])
                : "default"
            }
            onClick={() => setIsOpen(true)}
          >
            <Plus size={20} />
            <span>Nueva Comparativa</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="transition-all duration-700 ease-in-out w-full h-auto max-w-[900px] [&>button]:hidden">
          <DialogHeader className="mb-6">
            <div className="hidden">
              <DialogTitle className="text-lg text-primary-800 font-semibold">
                Creando una nueva comparativa
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-500 mb-4">
                Completa los pasos para crear una nueva comparativa
              </DialogDescription>
            </div>
            <CreateComparativaStepper steps={3} currentStep={activeTab} />
          </DialogHeader>
          {formElements[activeTab]}
        </DialogContent>
      </Dialog>
    </>
  );
}
