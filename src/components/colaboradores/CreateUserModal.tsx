"use client";
import { motion } from "framer-motion";

import {
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  useDisclosure,
} from "@heroui/modal";
import { Plus } from "lucide-react";
import CreateUserForm from "./CreateUserForm";

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
      <motion.button
        onClick={onOpen}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="w-fit text-nowrap flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl font-medium shadow-lg shadow-blue-500/20 hover:bg-blue-600 transition-colors"
      >
        <Plus size={20} />
        <span>Crear usuario</span>
      </motion.button>

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
