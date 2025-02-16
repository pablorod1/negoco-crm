"use client";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure,
} from "@heroui/modal";
import { Button, Progress } from "@heroui/react";
import { Plus } from "lucide-react";
import { useState } from "react";

interface Props {
  onCreateNote: (note: string) => void;
}

export default function CreateNoteDialog({ onCreateNote }: Props) {
  const { isOpen, onClose, onOpen } = useDisclosure();
  const [note, setNote] = useState("");

  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNote(e.target.value);
  };

  const handleCreateNote = () => {
    onCreateNote(note);
    onClose();
  };
  return (
    <>
      <Button
        size="lg"
        variant="bordered"
        color="primary"
        className="border-dashed h-auto bg-[var(--primary-color-100)]"
        onPress={onOpen}
      >
        <Plus size={24} />
        Crear nota
      </Button>

      <Modal
        isDismissable={false}
        hideCloseButton
        inert={!isOpen}
        isOpen={isOpen}
        onClose={onClose}
        size="xl"
      >
        <ModalContent>
          <ModalHeader className="text-[var(--primary-color-800)] text-xl pb-0">
            Crear nueva nota
          </ModalHeader>
          <ModalBody className="px-0">
            <div className="w-full relative">
              <textarea
                maxLength={50}
                rows={4}
                placeholder="Escribe una nota... (máx. 50 caracteres)"
                spellCheck={false}
                value={note}
                onChange={handleNoteChange}
                className="relative w-full focus:outline-none focus:ring-0 focus:border-0 resize-none bg-[var(--primary-color-50)] p-4"
              ></textarea>
              <Progress
                className="absolute bottom-1 z-50"
                radius="none"
                minValue={0}
                maxValue={50}
                value={note.length}
                color={`${
                  note.length === 50
                    ? "danger"
                    : note.length >= 25
                    ? "warning"
                    : "primary"
                }`}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button onPress={onClose} variant="ghost" color="danger">
              Cancelar
            </Button>
            <Button onPress={handleCreateNote} color="primary">
              Guardar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
