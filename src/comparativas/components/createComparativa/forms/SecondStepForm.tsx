import { showCustomToast } from "@/core/components/CustomToast";
import DocumentsForm from "@/tramites/components/DocumentsForm";
import FormWrapper from "@/tramites/components/createTramite/FormWrapper";
import { Button } from "@/core/components/ui/button";
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
        title: "Error de validación",
        message: "Debes subir al menos un documento para continuar",
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
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Document upload section */}
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-medium text-gray-900">
              Documentos requeridos
            </h3>
            <p className="text-xs text-gray-500">
              Sube al menos un documento para continuar con el proceso
            </p>
          </div>
          <DocumentsForm
            uploadedFiles={documents}
            setUploadedFiles={setDocuments}
          />
        </div>

        {/* Navigation Controls */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <Button
            variant="outline"
            onClick={onCancel}
            type="button"
            className="px-4"
          >
            Cancelar
          </Button>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={onBack}
              type="button"
              className="px-4"
            >
              Atrás
            </Button>
            <Button type="submit" className="px-4">
              Siguiente
            </Button>
          </div>
        </div>
      </form>
    </FormWrapper>
  );
}
