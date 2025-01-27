import { Divider } from "@heroui/divider";
import { useState } from "react";
import { TramiteDB } from "@/lib/types";

import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import ButtonGroupComponent from "./ButtonGroupComponent";
import FormWrapper from "./FormWrapper";
import DocumentsForm from "./DocumentsForm";

interface Props {
  onBack: () => void;
  onFinish: () => void;
  tramite: TramiteDB;
  setTramite: React.Dispatch<React.SetStateAction<TramiteDB>>;
  onCancel: () => void;
}

export default function FourthStepForm({
  onBack,
  onFinish,
  tramite,
  setTramite,
  onCancel,
}: Props) {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [newNote, setNewNote] = useState("");

  const handleNewNote = () => {
    if (newNote.length > 0) {
      setTramite((prevState) => ({
        ...prevState,
        notes: [...(prevState.notes || []), newNote],
      }));
      setNewNote("");
    }
  };

  const handleAddTramite = async () => {
    onFinish();
  };

  return (
    <FormWrapper>
      <form>
        <div className="flex  gap-4 w-full">
          <DocumentsForm
            uploadedFiles={uploadedFiles}
            setUploadedFiles={setUploadedFiles}
          />
          <Divider orientation="vertical" className="my-4" />
          <div className="flex flex-col w-full h-auto">
            <h3 className="mb-4">Notas</h3>
            <div className="w-full h-full flex flex-col gap-4">
              <Input
                name="notes"
                label="Añadir nota"
                size="lg"
                placeholder="Escribe una nota"
                onChange={(e) => setNewNote(e.target.value)}
                value={newNote}
              />
              {tramite.notes && tramite.notes.length > 0 && (
                <ul className="flex gap-4 flex-wrap min-h-24 max-h-32 overflow-auto">
                  {tramite.notes.map((note, index) => (
                    <li
                      key={index}
                      className="flex h-fit gap-4 py-2 bg-yellow-200 text-[var(--secondary-color)] px-4 w-fit rounded-br-lg"
                    >
                      {note}
                    </li>
                  ))}
                </ul>
              )}
              <Button
                className="capitalize mt-4 text-white font-semibold w-full text-base"
                color="primary"
                onPress={handleNewNote}
              >
                Añadir nota
              </Button>
            </div>
          </div>
        </div>
      </form>
      <ButtonGroupComponent
        onCancel={onCancel}
        onBack={onBack}
        onSubmit={handleAddTramite}
      />
    </FormWrapper>
  );
}
