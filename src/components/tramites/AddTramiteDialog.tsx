"use client";
import { useState } from "react";
import { useTramites } from "@/contexts/TramitesContext";

import FirstStepForm from "./createTramite/forms/FirstStepForm";
import {
  ClientDB,
  ContractDB,
  createEmptyClientDB,
  createEmptySignerDB,
  createEmptyTramiteDB,
  SignerDB,
  TramiteDB,
  User,
} from "@/lib/core/types";

import SecondStepForm from "./createTramite/forms/SecondStepForm";
import ThirdStepForm from "./createTramite/forms/ThirdStepForm";
import { Stepper } from "./Stepper";
import FourthStepForm from "./createTramite/forms/FourthStepForm";

import {
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  useDisclosure,
} from "@heroui/modal";
import { addCompleteTramite } from "@/lib/libsql/data/tramites/addTramites";
import { CheckCircle, CircleX, Plus } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { Button } from "@heroui/react";
import { showCustomToast } from "../core/CustomToast";

export default function AddTramiteDialog() {
  const { userData } = useUser();
  const [activeTab, setActiveTab] = useState(0);
  const [tramite, setTramite] = useState<TramiteDB>(
    createEmptyTramiteDB(userData as User)
  );
  const [client, setClient] = useState<ClientDB>(createEmptyClientDB());
  const [signer, setSigner] = useState<SignerDB>(createEmptySignerDB());
  const [contracts, setContracts] = useState<ContractDB[]>([]);
  const [documents, setDocuments] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const { isOpen, onClose, onOpen } = useDisclosure();
  const { refreshTramites } = useTramites();

  const handleOpen = () => {
    onOpen();
    setActiveTab(0);
    setTramite(createEmptyTramiteDB(userData as User));
    setClient(createEmptyClientDB());
    setSigner(createEmptySignerDB());
    setContracts([]);
    setDocuments([]);
  };

  const handleBack = () => {
    setActiveTab(() => activeTab - 1);
  };

  const handleNext = () => {
    addIds();
    setActiveTab(() => activeTab + 1);
  };

  const addIds = () => {
    setTramite((prev) => ({
      ...prev,
      client_id: client.id,
    }));
    setSigner((prev) => ({
      ...prev,
      client_id: client.id,
      signer_id: `SGN-${Math.floor(Math.random() * 10000)}`,
    }));
    contracts.forEach((contract) => {
      contract.tramite_id = tramite.id;
    });
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const { success, error } = await addCompleteTramite(
        tramite,
        client,
        signer,
        contracts,
        documents
      );

      if (success) {
        showCustomToast({
          title: "Trámite añadido",
          message: "El trámite ha sido añadido correctamente",
          iconColor: "var(--success-color)",
          iconSize: 24,
          icon: CheckCircle,
        });
        refreshTramites();
        onClose();
        return;
      }

      showCustomToast({
        title: "Error al añadir trámite",
        message: error,
        iconColor: "var(--danger-color)",
        iconSize: 24,
        icon: CircleX,
      });
      onClose();
    } catch (error) {
      console.error("Error al añadir trámite:", error);
      showCustomToast({
        title: "Error al añadir trámite",
        message: "Inténtalo de nuevo más tarde",
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
      client={client}
      tramite={tramite}
      onCancel={onClose}
    />,
    <SecondStepForm
      key={2}
      client={client}
      setClient={setClient}
      setSigner={setSigner}
      onSecondSubmitSuccess={handleNext}
      onBack={handleBack}
      onCancel={onClose}
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
    />,
  ];

  return (
    <>
      <Button
        onPress={handleOpen}
        color="primary"
        radius="sm"
        className="shadow-md"
      >
        <Plus size={20} />
        <span>Nuevo Trámite</span>
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
          className={`transition-all duration-700 ease-in-out w-full h-auto ${
            activeTab === 1 || activeTab === 3
              ? "max-w-[1400px]"
              : activeTab === 2
              ? "max-w-[1200px]"
              : "max-w-[800px]"
          }`}
        >
          <ModalHeader>
            <Stepper steps={4} currentStep={activeTab} />
          </ModalHeader>
          <ModalBody>{formElements[activeTab]}</ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
