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
  };

  const handleBack = () => {
    setActiveTab(() => activeTab - 1);
  };

  const handleNext = () => {
    if (activeTab === 3) {
      addIds();
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
    try {
      const formData = new FormData();

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
          onClose();
        }
      }

      refreshTramites();
      onClose();
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
      onSecondSubmitSuccess={handleNext}
      onBack={handleBack}
      onCancel={onClose}
      setSigner={setSigner}
      signer={signer as SignerDB}
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
      userData={userData as User}
      key={4}
      onBack={handleBack}
      onFinish={handleSubmit}
      tramite={tramite}
      setTramite={setTramite}
      onCancel={onClose}
      documents={documents}
      setDocuments={setDocuments}
      loading={loading}
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
