import { showCustomToast } from "@/components/core/CustomToast";
import DocumentsForm from "@/components/tramites/DocumentsForm";
import FormWrapper from "@/components/tramites/createTramite/FormWrapper";
import { Button } from "@/components/ui/button";
import { CircleX } from "lucide-react";

interface Props {
  documents: File[];
  setDocuments: React.Dispatch<React.SetStateAction<File[]>>;
  onCancel: () => void;
  onBack: () => void;
  onNext: () => void;
}

export default function SecondStepForm({
  documents,
  setDocuments,
  onCancel,
  onBack,
  onNext,
}: Props) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (documents.length === 0) {
      showCustomToast({
        title: "Error",
        message: "Debes subir al menos un documento",
        icon: CircleX,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
    } else {
      onNext();
    }
  };
  return (
    <FormWrapper>
      <form onSubmit={handleSubmit} className="relative">
        <div className="flex flex-col gap-4 w-full">
          <h2 className="text-xl text-primary-500 font-semibold">Documentos</h2>
          <DocumentsForm
            uploadedFiles={documents}
            setUploadedFiles={setDocuments}
          />
        </div>
        <div className="w-full justify-between flex items-center mt-4">
          <Button variant="destructive" onClick={onCancel}>
            Cancelar
          </Button>
          <div className="flex items-center gap-4">
            <Button variant={"destructive"} onClick={onBack}>
              Atrás
            </Button>
            <Button type="submit">Siguiente</Button>
          </div>
        </div>
      </form>
    </FormWrapper>
  );
}
