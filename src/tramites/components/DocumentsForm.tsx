import { useUser } from "@/core/contexts/UserContext";
import { XIcon, UploadCloud, FileIcon } from "lucide-react";
import Image from "next/image";
import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { getOrganizationLogo } from "@/core/branding/client";

interface DocumentsSectionProps {
  uploadedFiles: File[];
  setUploadedFiles: React.Dispatch<React.SetStateAction<File[]>>;
}

export default function DocumentsForm({
  uploadedFiles,
  setUploadedFiles,
}: DocumentsSectionProps) {
  const { userData } = useUser();
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      setUploadedFiles((prevFiles) => [...prevFiles, ...acceptedFiles]);
    },
    [setUploadedFiles]
  );

  const organizationLogo = getOrganizationLogo(userData?.organization);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
  });

  const handleRemoveFile = (
    e: React.MouseEvent<HTMLButtonElement>,
    file: File
  ) => {
    e.preventDefault();
    setUploadedFiles((prevFiles) =>
      prevFiles.filter((prevFile) => prevFile !== file)
    );
  };

  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={`
          group relative flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-xl cursor-pointer transition-all
          ${isDragActive ? "border-primary-500 bg-primary-50" : "border-gray-200 bg-white hover:border-primary-400 hover:bg-primary-50"}
          shadow-sm mb-4
        `}
      >
        <input {...getInputProps()} />
        <div className="absolute top-3 left-3 opacity-30 pointer-events-none">
          <Image
            src={organizationLogo.defaultUrl}
            width={organizationLogo.width}
            height={organizationLogo.height}
            alt={organizationLogo.alt}
            className="rounded"
          />
        </div>
        <div className="flex flex-col items-center justify-center z-10">
          <UploadCloud
            width={48}
            height={48}
            className="mb-2 text-primary-400 group-hover:text-primary-500 transition-colors"
          />
          <p className="mb-1 text-base text-primary-600 font-semibold text-center">
            {isDragActive
              ? "¡Suelta los archivos aquí!"
              : "Arrastra y suelta archivos o haz clic para seleccionar"}
          </p>
          <p className="text-xs text-gray-400">(Máx. 10MB por archivo)</p>
        </div>
      </div>

      {uploadedFiles.length > 0 && (
        <div className="mt-2">
          <h4 className="text-sm font-semibold text-primary-500 mb-2">
            Archivos nuevos seleccionados
          </h4>
          <ul className="space-y-2 max-h-40 overflow-y-auto">
            {uploadedFiles.map((file, index) => (
              <li
                key={index}
                className="flex items-center justify-between px-3 py-2 bg-primary-50 rounded-lg border border-primary-100"
              >
                <div className="flex items-center gap-2">
                  <FileIcon
                    width={16}
                    height={16}
                    className="text-primary-400"
                  />
                  <span className="text-sm font-medium">{file.name}</span>
                  <span className="text-xs text-gray-500 ml-2">
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <button
                  onClick={(e) => handleRemoveFile(e, file)}
                  className="hover:bg-primary-100 p-1 rounded-full transition-colors"
                  title="Eliminar archivo"
                >
                  <XIcon width={16} height={16} stroke="var(--danger-color)" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
