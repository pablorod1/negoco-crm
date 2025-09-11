"use client";
import { useCallback, useState } from "react";

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
import { cn } from "@/core/utils";

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

  const onClose = useCallback(async () => {
    // Clean up any tickets created with this comparativa ID if cancelling
    if (comparativa.id && activeTab > 0) {
      try {
        await fetch(`/api/v2/tickets/cleanup`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            context: "comparativa",
            ref_id: comparativa.id,
          }),
        });
      } catch (error) {
        console.error("Error cleaning up tickets:", error);
      }
    }

    setIsOpen(false);
    setActiveTab(0);
    setComparativa(createEmptyComparativaDB(userData as User));
    setDocuments([]);
  }, [comparativa.id, activeTab, userData]);

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
      const response = await fetch(`/api/v2/comparisons`, {
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
      userData={userData as User}
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
              className="h-9 px-4 text-sm font-medium"
              onClick={() => setIsOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              <span>Nueva Comparativa</span>
            </Button>
          ) : (
            <button
              onClick={() => setIsOpen(true)}
              className="group cursor-pointer w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200 hover:bg-gray-50 hover:shadow-sm border border-transparent hover:border-gray-200"
            >
              <div className="flex-shrink-0 p-2 rounded-md bg-gray-100 group-hover:bg-gray-200 text-gray-600 transition-colors duration-200">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <h5 className="font-medium text-sm text-gray-900 truncate">
                  Nueva Comparativa
                </h5>
                <p className="text-xs text-gray-500 truncate">
                  Solicita tu estudio energético
                </p>
              </div>
            </button>
          )}
        </DialogTrigger>
        <DialogContent
          className={cn(
            isStarterPlan
              ? "sm:max-w-[425px]"
              : "w-full h-auto max-w-4xl [&>button]:hidden",
            "overflow-visible max-h-[90vh] border-0 shadow-2xl"
          )}
        >
          {isStarterPlan ? (
            <>
              <DialogHeader className="space-y-3">
                <DialogTitle className="flex items-center gap-2 text-primary-600 text-lg">
                  <Rocket className="w-5 h-5" />
                  Mejora tu plan
                </DialogTitle>
                <DialogDescription className="text-gray-500 text-sm leading-relaxed">
                  La creación de comparativas está disponible en nuestros planes
                  Pro y Elite para ofrecerte análisis energéticos completos.
                </DialogDescription>
              </DialogHeader>
              <div className="py-6">
                <div className="p-4 bg-gray-50 rounded-lg border">
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Actualiza tu suscripción para acceder a todas las
                    funcionalidades premium como la creación de comparativas
                    energéticas personalizadas.
                  </p>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  className="px-4"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => {
                    window.location.href =
                      "mailto:soporte@negococloud.es?subject=Interesado en actualizar mi plan";
                    setIsOpen(false);
                  }}
                  className="px-4"
                >
                  Contactar a soporte
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader className="border-b border-gray-100 pb-6 mb-0 space-y-4">
                <div className="text-center space-y-2">
                  <DialogTitle className="text-xl font-semibold text-gray-900">
                    Nueva Comparativa Energética
                  </DialogTitle>
                  <DialogDescription className="text-sm text-gray-500 max-w-md mx-auto leading-relaxed">
                    Crea una comparativa personalizada para analizar las mejores
                    opciones energéticas disponibles
                  </DialogDescription>
                </div>
                <CreateComparativaStepper steps={3} currentStep={activeTab} />
              </DialogHeader>
              <div className="pt-6 pb-2">{formElements[activeTab]}</div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
