"use client";
import React from "react";
import {
  Modal,
  ModalContent,
  ModalBody,
  useDisclosure,
  ModalHeader,
} from "@heroui/modal";
import { Button } from "@heroui/button";
import { CircleX, PlusCircle } from "lucide-react";
import CreateBajaForm from "./CreateBajaForm";
import { useTramites } from "@/lib/contexts/TramitesContext";
import { showCustomToast } from "@/components/core/CustomToast";

export default function CreateBajaModal() {
  const { isOpen, onClose, onOpen } = useDisclosure();
  const { refreshTramites } = useTramites();

  const handleFinish = async () => {
    try {
      await refreshTramites();
      onClose();
    } catch (error) {
      console.error("Error refreshing tramites:", error);
      showCustomToast({
        title: "Error",
        message: "No se pudo refrescar la lista de tramites.",
        icon: CircleX,
        iconSize: 24,
        iconColor: "var(--danger-color)",
      });
      onClose();
    }
  };

  return (
    <>
      <Button onPress={onOpen} color="danger" radius="sm" className="shadow-md">
        <PlusCircle size={20} />
        <span>Nueva Baja</span>
      </Button>

      <Modal
        className="relative max-h-[90vh] overflow-y-auto py-2"
        classNames={{
          wrapper: "overflow-hidden",
        }}
        isDismissable={false}
        hideCloseButton
        size="3xl"
        backdrop="blur"
        isOpen={isOpen}
        onClose={onClose}
      >
        <ModalContent>
          <ModalHeader className="text-2xl text-danger font-bold">
            Nueva Baja
          </ModalHeader>
          <ModalBody>
            <CreateBajaForm onCancel={onClose} onFinish={handleFinish} />
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
