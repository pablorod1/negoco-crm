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
import { Textarea } from "@/core/components/ui/textarea";

interface Props {
  onCreateNote: (note: string) => void;
}

export default function CreateNoteDialog({ onCreateNote }: Props) {
  const [note, setNote] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNote(e.target.value);
  };

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
                Crear nueva nota
              </DialogTitle>
              <DialogDescription className="text-gray-500 text-sm">
                Escribe una nota para el trámite.
              </DialogDescription>
            </div>
          </DialogHeader>

          <Textarea
            aria-label="Escribe una nota"
            maxLength={500}
            rows={4}
            placeholder="Escribe una nota... (máx. 500 caracteres)"
            spellCheck={false}
            value={note}
            onChange={handleNoteChange}
            className="relative border-0 rounded-none shadow-none w-full resize-none bg-primary-50 p-4"
          />

          <DialogFooter className="!justify-between p-4">
            <Button onClick={onClose} variant="destructive">
              Cancelar
            </Button>
            <Button onClick={handleCreateNote}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

