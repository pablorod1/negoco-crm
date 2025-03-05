"use client";
import { Modal, ModalBody, ModalContent } from "@heroui/modal";

import EditTramiteForm from "./editTramite/forms/EditTramiteForm";

interface Props {
  tramite_id: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function EditTramiteDialog({
  tramite_id,
  isOpen,
  onClose,
}: Props) {
  return (
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
  );
}
