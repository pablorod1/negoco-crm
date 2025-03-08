"use client";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure,
} from "@heroui/modal";
import { Button } from "@heroui/button";
import { Progress } from "@heroui/progress";
import { PenLine } from "lucide-react";
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
      <Button variant="bordered" radius="sm" onPress={onOpen}>
        <PenLine size={16} />
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
                aria-label="Escribe una nota"
                maxLength={500}
                rows={4}
                placeholder="Escribe una nota... (máx. 500 caracteres)"
                spellCheck={false}
                value={note}
                onChange={handleNoteChange}
                className="relative w-full focus:outline-none focus:ring-0 focus:border-0 resize-none bg-[var(--primary-color-50)] p-4"
              ></textarea>
              <Progress
                aria-label="Contador de caracteres"
                className="absolute bottom-1 z-50"
                radius="none"
                minValue={0}
                maxValue={500}
                value={note.length}
                color={`${
                  note.length === 500
                    ? "danger"
                    : note.length >= 250
                    ? "warning"
                    : "primary"
                }`}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              onPress={onClose}
              variant="light"
              color="danger"
              radius="sm"
            >
              Cancelar
            </Button>
            <Button onPress={handleCreateNote} color="primary" radius="sm">
              Guardar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
