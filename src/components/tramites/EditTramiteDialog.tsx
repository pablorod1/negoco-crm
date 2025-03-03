"use client";
import { Pencil } from "lucide-react";
import { Modal, ModalBody, ModalContent, useDisclosure } from "@heroui/modal";
import { Button } from "@heroui/react";

import EditTramiteForm from "./editTramite/forms/EditTramiteForm";

interface Props {
  tramite_id: string;
}

export default function EditTramiteDialog({ tramite_id }: Props) {
  const { isOpen, onClose, onOpen } = useDisclosure();

  return (
    <>
      <Button
        variant="faded"
        onPress={onOpen}
        className="border-0 bg-transparent w-full text-gray-500 flex justify-start gap-4"
        startContent={<Pencil className="h-4 w-4 text-gray-500" />}
      >
        Editar
      </Button>
      <Modal
        radius="sm"
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
          <ModalBody className="relative">
            <EditTramiteForm
              onSubmit={onClose}
              tramite_id={tramite_id}
              onCancel={onClose}
            />
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
