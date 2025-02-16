"use client";
import { useState } from "react";
import { useTramites } from "@/contexts/TramitesContext";
import { motion } from "framer-motion";

import FirstStepForm from "./forms/createTramite/FirstStepForm";
import {
  ClientDB,
  ContractDB,
  createEmptyClientDB,
  createEmptySignerDB,
  createEmptyTramiteDB,
  SignerDB,
  TramiteDB,
} from "@/lib/types";

import SecondStepForm from "./forms/createTramite/SecondStepForm";
import ThirdStepForm from "./forms/createTramite/ThirdStepForm";
import { Stepper } from "./Stepper";
import FourthStepForm from "./forms/createTramite/FourthStepForm";

import {
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  useDisclosure,
} from "@heroui/modal";
import toast from "react-hot-toast";
import { addCompleteTramite } from "@/lib/libsql/data/addData";
import { Plus } from "lucide-react";

export default function AddTramiteDialog() {
  const [activeTab, setActiveTab] = useState(0);
  const [tramite, setTramite] = useState<TramiteDB>(createEmptyTramiteDB());
  const [client, setClient] = useState<ClientDB>(createEmptyClientDB());
  const [signer, setSigner] = useState<SignerDB>(createEmptySignerDB());
  const [contracts, setContracts] = useState<ContractDB[]>([]);
  const [documents, setDocuments] = useState<File[]>([]);
  const { isOpen, onClose, onOpen } = useDisclosure();
  const { refreshTramites } = useTramites();

  const handleOpen = () => {
    onOpen();
    setActiveTab(0);
    setTramite(createEmptyTramiteDB());
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
    try {
      const { success, error } = await addCompleteTramite(
        tramite,
        client,
        signer,
        contracts,
        documents
      );

      if (success) {
        toast.success("Trámite añadido correctamente");
        refreshTramites();
        onClose();
        return;
      }

      toast.error(`Error al añadir trámite: ${error}`);
      onClose();
    } catch (error) {
      console.error("Error al añadir trámite:", error);
      toast.error("Error desconocido al añadir trámite");
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
    />,
  ];

  return (
    <>
      <motion.button
        onClick={handleOpen}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="w-fit text-nowrap flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl font-medium shadow-lg shadow-blue-500/20 hover:bg-blue-600 transition-colors"
      >
        <Plus size={20} />
        <span>Nuevo Trámite</span>
      </motion.button>

      <Modal
        isDismissable={false}
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
