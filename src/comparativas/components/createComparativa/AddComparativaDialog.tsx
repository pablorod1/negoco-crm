"use client";
import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTrigger,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/core/components/ui/dialog";
import { BarChart3, CheckCircle, CircleX, Plus, Rocket } from "lucide-react";
import { useUser } from "@/core/contexts/UserContext";
import { Button } from "@/core/components/ui/button";
import { CreateComparativaStepper } from "./CreateComparativaStepper";
import { ComparativaDB, ComparativaFile } from "@/comparativas/types";
import { createEmptyComparativaDB } from "@/comparativas/utils/comparativa.factories";
import { User } from "@/core/types";
import FirstStepForm from "./forms/FirstStepForm";
import SecondStepForm from "./forms/SecondStepForm";
import ThirdStepForm from "./forms/ThirdStepForm";
import { showCustomToast } from "@/core/components/CustomToast";
import { useComparativas } from "@/core/contexts/ComparativasContext";
import { uploadFile } from "@/core/firebase/data/uploadFiles";
import { type VariantProps } from "class-variance-authority";
import { buttonVariants } from "@/core/components/ui/button";

export default function AddComparativaDialog({
  variant,
  shortcut = false,
}: {
  variant?: string;
  shortcut?: boolean;
}) {
  const { userData, getPlan } = useUser();
  const { refreshComparativas } = useComparativas();
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const userPlan = getPlan();
  const isStarterPlan = userPlan === "starter";

  const [comparativa, setComparativa] = useState<ComparativaDB>(
    createEmptyComparativaDB(userData as User)
  );
  const [documents, setDocuments] = useState<File[]>([]);

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
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
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
              <span>Nueva Comparativa</span>
            </Button>
          ) : (
            <button
              onClick={() => setIsOpen(true)}
              className="group cursor-pointer w-full flex items-start gap-3 p-3 rounded-lg transition-all duration-200 hover:bg-green-50 hover:shadow-sm border border-transparent hover:border-green-200"
            >
              <div className="p-2 rounded-md bg-green-50 group-hover:bg-green-100 text-green-600 transition-colors duration-200">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div className="flex-1 text-left">
                <h5 className="font-medium text-sm text-gray-900">
                  Nueva Comparativa
                </h5>
                <p className="text-xs text-gray-600">
                  Solicita tu estudio energético
                </p>
              </div>
            </button>
          )}
        </DialogTrigger>
        <DialogContent
          className={
            isStarterPlan
              ? "sm:max-w-[425px]"
              : "transition-all duration-700 ease-in-out w-full h-auto max-w-[900px] [&>button]:hidden"
          }
        >
          {isStarterPlan ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-primary">
                  <Rocket size={20} />
                  Mejora tu plan
                </DialogTitle>
                <DialogDescription>
                  La creación de comparativas está disponible en nuestros planes
                  Pro y Elite.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <p className="text-sm text-gray-500">
                  Actualiza tu suscripción para acceder a todas las
                  funcionalidades premium como la creación de comparativas.
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => {
                    window.location.href =
                      "mailto:soporte@negococloud.es?subject=Interesado en actualizar mi plan";
                    setIsOpen(false);
                  }}
                >
                  Contactar a soporte
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
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
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
