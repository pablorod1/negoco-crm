"use client";

import {
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  useDisclosure,
} from "@heroui/modal";
import { Plus } from "lucide-react";
import CreateUserForm from "./CreateUserForm";
import { Button } from "@heroui/button";

export default function CreateUserModal({
  onUserCreated,
}: {
  onUserCreated: () => void;
}) {
  const { isOpen, onClose, onOpen } = useDisclosure();

  const handleUserCreated = () => {
    onUserCreated();
    onClose();
  };

  return (
    <>
      <Button color="primary" onPress={onOpen}>
        <Plus size={20} />
        <span>Crear usuario</span>
      </Button>

      <Modal inert={!isOpen} isOpen={isOpen} onClose={onClose}>
        <ModalContent>
          <ModalHeader>Crear usuario</ModalHeader>
          <ModalBody>
            <CreateUserForm onUserCreated={handleUserCreated} />
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
