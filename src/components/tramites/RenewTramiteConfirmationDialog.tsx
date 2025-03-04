"use client";
import { CircleX, RefreshCcw } from "lucide-react";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure,
} from "@heroui/modal";
import { Button } from "@heroui/react";

import EditTramiteDialog from "./EditTramiteDialog";
import { useTramites } from "@/contexts/TramitesContext";
import { showCustomToast } from "../core/CustomToast";

interface Props {
  tramite_id: string;
}

export default function RenewTramiteConfirmationDialog({ tramite_id }: Props) {
  const { isOpen, onClose, onOpen } = useDisclosure();
  const { refreshTramites } = useTramites();

  const handleRenewTramite = async () => {
    try {
      const res = await fetch(`/api/tramites/renew`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: tramite_id }),
      });

      const { success, error } = await res.json();

      if (!success && error) {
        showCustomToast({
          title: "Error al renovar el trámite",
          message: error,
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: CircleX,
        });
      }

      showCustomToast({
        title: "Trámite renovado",
        message: "El trámite ha sido renovado correctamente",
        iconColor: "var(--success-color)",
        iconSize: 24,
        icon: RefreshCcw,
      });
      refreshTramites();
      onClose();
    } catch (error) {
      showCustomToast({
        title: "Error al renovar el trámite",
        message: "Inténtalo de nuevo más tarde",
        iconColor: "var(--danger-color)",
        iconSize: 24,
        icon: CircleX,
      });
      console.error(error);
    }
  };

  return (
    <>
      <Button
        variant="faded"
        isIconOnly
        onPress={onOpen}
        className="border-0 bg-transparent"
      >
        <RefreshCcw className="h-4 w-4 text-gray-500" />
      </Button>
      <Modal
        size="xl"
        inert={!isOpen}
        isOpen={isOpen}
        onClose={onClose}
        classNames={{
          wrapper: "overflow-hidden",
        }}
      >
        <ModalContent className="py-2 w-full max-h-[90vh] overflow-auto">
          <ModalHeader className="text-lg font-semibold text-[var(--primary-color-800)]">
            ¿Estás seguro de renovar el siguiente trámite?
          </ModalHeader>
          <ModalBody className="flex flex-row items-center gap-4">
            <span>Tramite - {tramite_id}</span>
            <EditTramiteDialog tramite_id={tramite_id} />
          </ModalBody>
          <ModalFooter className="flex justify-end items-center gap-2">
            <Button variant="ghost" color="danger" onPress={onClose}>
              Cancelar
            </Button>
            <Button color="primary" onPress={handleRenewTramite}>
              Confirmar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
