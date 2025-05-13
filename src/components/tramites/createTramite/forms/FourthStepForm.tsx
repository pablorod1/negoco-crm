"use client";
import {
  ClientDB,
  ComparativaFile,
  TramiteDB,
  TramiteFile,
} from "@/lib/core/types";

import ButtonGroupComponent from "@/components/core/ButtonGroupComponent";
import FormWrapper from "../FormWrapper";
import DocumentsForm from "../../DocumentsForm";
import NotesBoard from "@/components/core/NotesBoard";
import { EyeIcon, FileIcon } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Props {
  onBack: () => void;
  onFinish: () => void;
  tramite: TramiteDB;
  setTramite: React.Dispatch<React.SetStateAction<TramiteDB>>;
  onCancel: () => void;
  documents: File[];
  setDocuments: React.Dispatch<React.SetStateAction<File[]>>;
  loading: boolean;
  client: ClientDB;
  selectedExistingFiles: TramiteFile[] | null;
  setSelectedExistingFiles: React.Dispatch<
    React.SetStateAction<TramiteFile[] | null>
  >;
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
  comparativaFiles,
  client,
  selectedExistingFiles,
  setSelectedExistingFiles,
}: Props) {
  const [loadingExistingFiles, setLoadingExistingFiles] =
    useState<boolean>(false);
  const [existingFiles, setExistingFiles] = useState<TramiteFile[] | null>(
    null
  );

  const handleNewNote = (note: string) => {
    setTramite((prev) => ({
      ...prev,
      notes: [...prev.notes, note],
    }));
  };

  const handleAddTramite = () => {
    // Aquí puedes añadir la lógica para adjuntar los archivos seleccionados
    // al trámite antes de llamar a onFinish si es necesario.
    onFinish();
  };

  useEffect(() => {
    const fetchExistingFiles = async () => {
      setLoadingExistingFiles(true);
      try {
        const response = await fetch(
          `/api/clients/get/${client.id}/tramite-files`,
          {
            method: "POST",
          }
        );
        const { data, success } = await response.json();

        if (success && !data) {
          setLoadingExistingFiles(false);
          return;
        }

        setExistingFiles(data);
      } catch (error) {
        console.error("Error fetching existing files:", error);
      } finally {
        setLoadingExistingFiles(false);
      }
    };

    fetchExistingFiles();
  }, [client.id, setExistingFiles]);

  const handleSelectExistingFile = (file: TramiteFile) => {
    if (selectedExistingFiles) {
      const isSelected = selectedExistingFiles.some(
        (selectedFile) => selectedFile.id === file.id
      );
      if (isSelected) {
        setSelectedExistingFiles((prev) => {
          if (!prev) return [];
          return prev.filter((selectedFile) => selectedFile.id !== file.id);
        });
      } else {
        setSelectedExistingFiles((prev) => [...(prev || []), file]);
      }
    } else {
      setSelectedExistingFiles([file]);
    }
  };

  return (
    <FormWrapper>
      <form className="relative">
        <div
          className={`flex flex-col xl:flex-row gap-4 w-full ${loading && "blur-sm"} p-2`}
        >
          <div className="flex-1 bg-white rounded-xl shadow-md border border-gray-100 p-6 ">
            {/* Sección de archivos */}
            <h2 className="text-2xl font-bold text-primary-600 mb-2 flex items-center gap-2">
              <FileIcon className="text-primary-500" /> Documentación del
              trámite
            </h2>
            <p className="text-gray-500 mb-6">
              Adjunta nuevos archivos o selecciona de los ya existentes en la
              base de datos del cliente.
            </p>
            {/* Archivos existentes */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-semibold text-primary-500">
                  Archivos existentes
                </span>
                {loadingExistingFiles && (
                  <svg
                    className="animate-spin h-4 w-4 text-primary-400"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    ></path>
                  </svg>
                )}
              </div>
              {!loadingExistingFiles &&
              existingFiles &&
              existingFiles.length > 0 ? (
                <ul className="space-y-2 max-h-40 overflow-y-auto border rounded-lg p-2 bg-gray-50">
                  {existingFiles.map((file, index) => (
                    <li
                      key={index}
                      className={`flex items-center justify-between px-3 py-2 rounded transition-colors ${
                        selectedExistingFiles?.some(
                          (selectedFile) => selectedFile.id === file.id
                        )
                          ? "bg-primary-50 border border-primary-200"
                          : "hover:bg-gray-100"
                      }`}
                    >
                      <label className="flex items-center gap-2 cursor-pointer w-full">
                        <input
                          type="checkbox"
                          checked={
                            !!selectedExistingFiles?.some(
                              (selectedFile) => selectedFile.id === file.id
                            )
                          }
                          onChange={() => handleSelectExistingFile(file)}
                          className="accent-primary-500"
                        />
                        <FileIcon
                          width={16}
                          height={16}
                          className="text-primary-400"
                        />
                        <span className="text-sm font-medium">
                          {file.filename}
                        </span>
                        <span className="text-xs text-gray-500 ml-2">
                          ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                      </label>
                      <Link href={file.download_url} target="_blank">
                        <EyeIcon size={16} stroke="#333" />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : !loadingExistingFiles ? (
                <div className="text-gray-400 text-sm italic">
                  No hay archivos existentes.
                </div>
              ) : null}
            </div>
            {/* Archivos nuevos */}
            <div className="mb-6">
              <span className="font-semibold text-primary-500 mb-2 block">
                Subir nuevos archivos
              </span>
              <DocumentsForm
                uploadedFiles={documents}
                setUploadedFiles={setDocuments}
              />
            </div>
            {/* Archivos de comparativa */}
            {comparativaFiles && comparativaFiles.length > 0 && (
              <div className="mb-6">
                <span className="font-semibold text-primary-500 mb-2 block">
                  Archivos de comparativa
                </span>
                <ul className="space-y-2 max-h-32 overflow-y-auto border rounded-lg p-2 bg-gray-50">
                  {comparativaFiles.map((file, index) => (
                    <li
                      key={index}
                      className="flex items-center gap-2 px-3 py-2 rounded hover:bg-gray-100"
                    >
                      <FileIcon
                        width={16}
                        height={16}
                        className="text-primary-400"
                      />
                      <span className="text-sm font-medium">
                        {file.filename}
                      </span>
                      <span className="text-xs text-gray-500 ml-2">
                        ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Sección de notas */}
          <div className=" flex flex-col bg-gradient-to-b from-primary-50 to-white rounded-xl shadow-md border border-gray-100 p-6 min-h-[350px]">
            <ScrollArea className="w-full h-full max-h-[calc(100vh-350px)] px-2">
              <h3 className="text-xl font-bold text-primary-600 mb-2">
                Notas internas
              </h3>
              <p className="text-gray-500 mb-4">
                Añade comentarios o instrucciones internas para este trámite.
              </p>
              <div className="flex-1">
                <NotesBoard
                  notes={tramite.notes as string[]}
                  onCreateNote={handleNewNote}
                />
              </div>
            </ScrollArea>
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
