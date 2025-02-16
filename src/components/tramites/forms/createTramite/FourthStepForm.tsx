import { Divider } from "@heroui/divider";
import { TramiteDB } from "@/lib/types";

import ButtonGroupComponent from "./ButtonGroupComponent";
import FormWrapper from "./FormWrapper";
import DocumentsForm from "./DocumentsForm";
import NotesBoard from "../editTramite/NotesBoard";

interface Props {
  onBack: () => void;
  onFinish: () => void;
  tramite: TramiteDB;
  setTramite: React.Dispatch<React.SetStateAction<TramiteDB>>;
  onCancel: () => void;
  documents: File[];
  setDocuments: React.Dispatch<React.SetStateAction<File[]>>;
}

export default function FourthStepForm({
  onBack,
  onFinish,
  tramite,
  setTramite,
  onCancel,
  documents,
  setDocuments,
}: Props) {
  const handleNewNote = (note: string) => {
    setTramite((prev) => ({
      ...prev,
      notes: [...prev.notes, note],
    }));
  };

  const handleAddTramite = () => {
    onFinish();
  };

  return (
    <FormWrapper>
      <form>
        <div className="flex flex-col gap-4 w-full">
          <h2 className="text-xl text-[var(--primary-color-500)] font-semibold">
            Documentos
          </h2>
          <DocumentsForm
            uploadedFiles={documents}
            setUploadedFiles={setDocuments}
          />
          <Divider />
          <div className="w-full h-auto">
            <NotesBoard
              notes={tramite.notes as string[]}
              onCreateNote={handleNewNote}
            />
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
