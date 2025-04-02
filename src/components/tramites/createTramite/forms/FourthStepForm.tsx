import { Divider } from "@heroui/divider";
import { ComparativaFile, TramiteDB } from "@/lib/core/types";

import ButtonGroupComponent from "@/components/core/ButtonGroupComponent";
import FormWrapper from "../FormWrapper";
import DocumentsForm from "../../DocumentsForm";
import NotesBoard from "@/components/core/NotesBoard";
import { FileIcon } from "lucide-react";
import UploadProgressBar from "@/components/tramites/createTramite/UploadProgressBar";
import { UploadStatus } from "@/components/tramites/createTramite/AddTramiteDialog";

interface Props {
  onBack: () => void;
  onFinish: () => void;
  tramite: TramiteDB;
  setTramite: React.Dispatch<React.SetStateAction<TramiteDB>>;
  onCancel: () => void;
  documents: File[];
  setDocuments: React.Dispatch<React.SetStateAction<File[]>>;
  loading: boolean;
  uploadStatus: UploadStatus;
  comparativaFiles?: ComparativaFile[];
}

export default function FourthStepForm({
  onBack,
  onFinish,
  tramite,
  setTramite,
  onCancel,
  documents,
  setDocuments,
  loading,
  uploadStatus,
  comparativaFiles,
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
      {loading && (
        <UploadProgressBar
          progress={uploadStatus.progress}
          currentStep={uploadStatus.currentStep}
          filesTotal={uploadStatus.filesTotal}
          filesUploaded={uploadStatus.filesUploaded}
          status={uploadStatus.status}
          error={uploadStatus.error}
        />
      )}
      <form className="relative">
        <div className={`flex flex-col gap-4 w-full ${loading && "blur-sm"}`}>
          <h2 className="text-xl text-primary-500 font-semibold">Documentos</h2>
          <DocumentsForm
            uploadedFiles={documents}
            setUploadedFiles={setDocuments}
          />
          {comparativaFiles && comparativaFiles.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Archivos adjuntos a la comparativa
              </h4>
              <p className="text-sm text-gray-500 mb-2">
                Estos archivos se adjuntarán ahora al trámite. Se eliminarán
                automáticamente de la comparativa.
              </p>
              <ul className="space-y-2">
                {comparativaFiles.map((file, index) => (
                  <li
                    key={index}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded"
                  >
                    <div className="flex items-center space-x-2">
                      <FileIcon width={16} height={16} />
                      <span className="text-sm">{file.filename}</span>
                      <span className="text-xs text-gray-500">
                        ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
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
        loading={loading}
        lastStep
      />
    </FormWrapper>
  );
}
