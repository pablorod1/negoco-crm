import { useUser } from "@/lib/contexts/UserContext";
import { XIcon, UploadCloud, FileIcon } from "lucide-react";
import Image from "next/image";
import { useCallback } from "react";
import { useDropzone } from "react-dropzone";

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

  const isBeenergy = userData && userData.organization.name === "Beenergy";

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
    <div className="w-full mb-4">
      <div
        {...getRootProps()}
        className={`overflow-hidden relative flex flex-col items-center justify-center w-full h-44 border-2 border-dashed rounded-lg cursor-pointer transition-colors
          ${
            isDragActive
              ? "border-primary bg-primary-50"
              : "border-gray-300 bg-gray-50 hover:bg-gray-100"
          }`}
      >
        <input {...getInputProps()} />
        <Image
          src={isBeenergy ? "/beenergy.png" : "/logo.webp"}
          width={500}
          height={500}
          alt="Beenergy Logo"
          className="absolute top-0 left-0 w-1/4 opacity-50"
        />
        <div className="flex flex-col items-center justify-center pt-5 pb-6 relative">
          <UploadCloud width={40} height={40} className="mb-3 text-gray-400" />
          <p className="mb-2 text-sm text-gray-500 font-semibold">
            {isDragActive
              ? "Suelta los archivos aquí..."
              : "Arrastra y suelta archivos o haz clic para seleccionar"}
          </p>
          <p className="text-xs text-gray-500">
            PDF, DOC, DOCX, PNG, JPG, JPEG
          </p>
        </div>
      </div>

      {uploadedFiles.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Archivos subidos
          </h4>
          <ul className="space-y-2">
            {uploadedFiles.map((file, index) => (
              <li
                key={index}
                className="flex items-center justify-between p-2 bg-gray-50 rounded"
              >
                <div className="flex items-center space-x-2">
                  <FileIcon width={16} height={16} />
                  <span className="text-sm">{file.name}</span>
                  <span className="text-xs text-gray-500">
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <button
                  onClick={(e) => handleRemoveFile(e, file)}
                  className="hover:bg-gray-100 p-1 rounded-full transition-colors"
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
