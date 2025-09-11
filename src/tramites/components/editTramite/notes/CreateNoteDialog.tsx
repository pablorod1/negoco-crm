"use client";

import { Button } from "@/core/components/ui/button";
import { PenLine } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/core/components/ui/dialog";

interface Props {
  onCreateNote: (note: string) => void;
}

export default function CreateNoteDialog({ onCreateNote }: Props) {
  const [note, setNote] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const onOpen = () => {
    setIsOpen(true);
    setNote("");
  };

  const handleCreateNote = () => {
    onCreateNote(note);
    onClose();
  };

  const onClose = () => {
    setIsOpen(false);
    setNote("");
  };

  return (
    <>
      <Dialog open={isOpen}>
        <DialogTrigger asChild>
          <Button variant="default" onClick={onOpen}>
            <PenLine size={16} />
            Crear nota
          </Button>
        </DialogTrigger>
        <DialogContent className="p-0 [&>button]:hidden">
          <DialogHeader className="px-4 pt-4 pb-0">
            <div>
              <DialogTitle className="text-primary-800 text-xl">
                Este sistema de notas no está disponible
              </DialogTitle>
              <DialogDescription className="text-gray-500 text-sm">
                Este sistema de notas ha sido sustituido por un sistema de
                tickets. Por favor, utiliza el sistema de tickets para crear y
                gestionar notas.
              </DialogDescription>
            </div>
          </DialogHeader>

          <DialogFooter className="!justify-between p-4">
            <Button onClick={onClose} variant="destructive">
              Cancelar
            </Button>
            <Button disabled onClick={handleCreateNote}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
