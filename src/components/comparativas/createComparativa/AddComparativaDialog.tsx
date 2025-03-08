"use client";
import { useState } from "react";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  useDisclosure,
} from "@heroui/modal";
import { CheckCircle, CircleX, Plus } from "lucide-react";
import { useUser } from "@/lib/contexts/UserContext";
import { Button } from "@heroui/button";
import { ButtonProps } from "@heroui/button";
import { CreateComparativaStepper } from "./CreateComparativaStepper";
import {
  ComparativaDB,
  createEmptyComparativaDB,
  User,
} from "@/lib/core/types";
import FirstStepForm from "./forms/FirstStepForm";
import SecondStepForm from "./forms/SecondStepForm";
import ThirdStepForm from "./forms/ThirdStepForm";
import { showCustomToast } from "@/components/core/CustomToast";

export default function AddComparativaDialog({
  color,
}: {
  color?: ButtonProps["color"];
}) {
  const { userData } = useUser();
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const { isOpen, onClose, onOpen } = useDisclosure();
  const [comparativa, setComparativa] = useState<ComparativaDB>(
    createEmptyComparativaDB(userData as User)
  );
  const [documents, setDocuments] = useState<File[]>([]);

  const handleOpen = () => {
    onOpen();
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
      const formData = new FormData();
      formData.append("comparativa", JSON.stringify(comparativa));
      documents.forEach((doc) => {
        formData.append("files", doc);
      });
      formData.append("organization_id", userData?.organization.id as string);
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
      });
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
      onClose();
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
      <Button
        onPress={handleOpen}
        color={color ? color : "primary"}
        radius="sm"
        className="shadow-md"
      >
        <Plus size={20} />
        <span>Nueva Comparativa</span>
      </Button>

      <Modal
        isDismissable={false}
        radius="sm"
        hideCloseButton
        inert={!isOpen}
        isOpen={isOpen}
        onClose={onClose}
      >
        <ModalContent
          className={`transition-all duration-700 ease-in-out w-full h-auto max-w-[900px]`}
        >
          <ModalHeader>
            <CreateComparativaStepper steps={3} currentStep={activeTab} />
          </ModalHeader>
          <ModalBody className="py-4">{formElements[activeTab]}</ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
