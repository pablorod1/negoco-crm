"use client";
import { Pencil } from "lucide-react";
import { Modal, ModalBody, ModalContent, useDisclosure } from "@heroui/modal";
import { Button } from "@heroui/react";

import EditTramiteForm from "./forms/editTramite/EditTramiteForm";

interface Props {
  tramite_id: string;
}

export default function EditTramiteDialog({ tramite_id }: Props) {
  const { isOpen, onClose, onOpen } = useDisclosure();

  return (
    <>
      <Button
        variant="faded"
        isIconOnly
        onPress={onOpen}
        className="border-0 bg-transparent"
      >
        <Pencil className="h-4 w-4 text-gray-500" />
      </Button>
      <Modal
        size="5xl"
        isDismissable={false}
        hideCloseButton
        inert={!isOpen}
        isOpen={isOpen}
        onClose={onClose}
        classNames={{
          wrapper: "overflow-hidden",
        }}
      >
        <ModalContent className="py-2 max-w-[70vw] w-full max-h-[90vh] overflow-auto">
          <ModalBody>
            <EditTramiteForm tramite_id={tramite_id} onCancel={onClose} />
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
