"use client";
import { useState } from "react";

import FirstStepForm from "./forms/FirstStepForm";
import {
  ClientDB,
  createEmptyClientDB,
  createEmptySignerDB,
  createEmptyTramiteDB,
  SignerDB,
  TramiteDB,
} from "@/lib/types";

import SecondStepForm from "./forms/SecondStepForm";
import { Card, CardTitle } from "../ui/card";
import { Plus } from "lucide-react";
import ThirdStepForm from "./forms/ThirdStepForm";
import { Stepper } from "./Stepper";
import FourthStepForm from "./forms/FourthStepForm";

import {
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  useDisclosure,
} from "@heroui/modal";
import toast from "react-hot-toast";

export default function AddTramiteDialog() {
  const [activeTab, setActiveTab] = useState(0);
  const [tramite, setTramite] = useState<TramiteDB>(createEmptyTramiteDB());
  const [client, setClient] = useState<ClientDB>(createEmptyClientDB());
  const [signer, setSigner] = useState<SignerDB>(createEmptySignerDB());
  const { isOpen, onClose, onOpen } = useDisclosure();

  const handleBack = () => {
    setActiveTab(() => activeTab - 1);
  };

  const handleNext = () => {
    setActiveTab(() => activeTab + 1);
  };

  const handleSubmit = () => {
    console.log("Tramite", tramite);
    console.log("Client", client);
    console.log("Signer", signer);
    toast.success("Trámite creado correctamente");
    onClose();
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
    />,
    <FourthStepForm
      key={4}
      onBack={handleBack}
      onFinish={handleSubmit}
      tramite={tramite}
      setTramite={setTramite}
      onCancel={onClose}
    />,
  ];

  return (
    <>
      <button className="w-full max-w-xs" onClick={onOpen}>
        <Card className="py-4 px-8 w-full hover:bg-[var(--primary-color-50)]">
          <div className="flex items-center justify-between">
            <CardTitle>
              <h3 className="text-xl text-gray-800">Añadir Trámite</h3>
            </CardTitle>
            <Plus className="w-8 h-8 text-[var(--primary-color-500)]" />
          </div>
        </Card>
      </button>
      <Modal inert={!isOpen} isOpen={isOpen} onClose={onClose}>
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
