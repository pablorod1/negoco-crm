import ButtonGroupComponent from "@/components/core/ButtonGroupComponent";
import DocumentsForm from "@/components/tramites/DocumentsForm";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { useState } from "react";

interface Props {
  uploadedFiles: File[];
  setUploadedFiles: React.Dispatch<React.SetStateAction<File[]>>;
  onUpload: () => void;
  loading: boolean;
  buttonText?: string;
}

export default function UploadComercializadoraFilesDialog({
  uploadedFiles,
  setUploadedFiles,
  onUpload,
  loading,
  buttonText = "Subir Primer Documento",
}: Props) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = () => {
    onUpload();
    setIsOpen(false);
  };

  const onClose = () => setIsOpen(false);
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="h-5 w-5" />
          {buttonText}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-primary-800">
            Subir Archivos de Comercializadora
          </DialogTitle>
          <DialogDescription>
            Selecciona los archivos que deseas subir para la comercializadora.
          </DialogDescription>
        </DialogHeader>
        <DocumentsForm
          uploadedFiles={uploadedFiles}
          setUploadedFiles={setUploadedFiles}
        />
        <DialogFooter>
          <ButtonGroupComponent
            onSubmit={handleSubmit}
            onCancel={onClose}
            lastStep
            loading={loading}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
