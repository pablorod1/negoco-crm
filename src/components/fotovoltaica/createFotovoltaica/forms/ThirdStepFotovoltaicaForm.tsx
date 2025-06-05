import ButtonGroupComponent from "@/components/core/ButtonGroupComponent";
import { showCustomToast } from "@/components/core/CustomToast";
import FormWrapper from "@/components/tramites/createTramite/FormWrapper";
import DocumentsForm from "@/components/tramites/DocumentsForm";
import { CircleX } from "lucide-react";

interface Props {
  uploadedFiles: File[];
  setUploadedFiles: React.Dispatch<React.SetStateAction<File[]>>;
  onSubmit: () => void;
  onCancel: () => void;
  onBack: () => void;
}

export default function ThirdStepFotovoltaicaForm({
  uploadedFiles,
  setUploadedFiles,
  onSubmit,
  onCancel,
  onBack,
}: Props) {
  const handleSubmit = (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (uploadedFiles.length === 0) {
      showCustomToast({
        title: "Error",
        message: "Debes subir al menos un documento",
        icon: CircleX,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
    } else {
      onSubmit();
    }
  };
  return (
    <FormWrapper>
      <DocumentsForm
        uploadedFiles={uploadedFiles}
        setUploadedFiles={setUploadedFiles}
      />
      <ButtonGroupComponent
        onSubmit={handleSubmit}
        onCancel={onCancel}
        onBack={onBack}
      />
    </FormWrapper>
  );
}
