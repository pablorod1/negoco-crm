import { formatFileSize } from "@/lib/core/format";
import DocumentsForm from "../../createTramite/forms/DocumentsForm";
import Image from "next/image";
import { EditFormWrapper } from "../EditFormWrapper";
import { TramiteFile, User } from "@/lib/core/types";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface Props {
  files?: TramiteFile[];
  uploadedFiles: File[];
  setUploadedFiles: React.Dispatch<React.SetStateAction<File[]>>;
  userData: User;
}

export default function EditTramiteFiles({
  files,
  uploadedFiles,
  setUploadedFiles,
  userData,
}: Props) {
  return (
    <EditFormWrapper title="Documentos">
      <ScrollArea>
        <div className="flex space-x-4 p-4 w-max">
          {files &&
            files.map((doc, index) => (
              <div
                key={index}
                className="flex flex-col bg-white rounded-lg shadow-md overflow-hidden w-56 transition-all duration-300 ease-in-out hover:shadow-lg"
              >
                <div className="relative w-full h-16">
                  {doc.extension === "pdf" ? (
                    <Image
                      src={"/file-icons/pdf.png"}
                      objectFit="contain"
                      objectPosition="center"
                      layout="fill"
                      alt={doc.filename}
                    />
                  ) : doc.extension === "png" ||
                    doc.extension.toLowerCase() === "jpg" ||
                    doc.extension.toLowerCase() === "jpeg" ? (
                    <Image
                      src={doc.download_url}
                      objectFit="contain"
                      objectPosition="center"
                      layout="fill"
                      alt={doc.filename}
                    />
                  ) : (
                    <Image
                      src={"/file-icons/file.png"}
                      objectFit="contain"
                      objectPosition="center"
                      layout="fill"
                      alt={doc.filename}
                    />
                  )}
                </div>
                <div className="p-4 flex flex-col gap-2">
                  <h3
                    className="font-semibold text-gray-800 truncate"
                    title={doc.filename}
                  >
                    {doc.filename}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {formatFileSize(doc.size)}
                  </p>
                  <a
                    href={doc.download_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 px-4 py-2 bg-blue-600 text-white text-center rounded-md hover:bg-blue-700 transition-colors duration-300 ease-in-out"
                  >
                    Ver archivo
                  </a>
                  {/* <Button color="primary" radius="sm">
                      Descargar
                    </Button> */}
                </div>
              </div>
            ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      {userData.role !== "2" && (
        <DocumentsForm
          uploadedFiles={uploadedFiles}
          setUploadedFiles={setUploadedFiles}
        />
      )}
    </EditFormWrapper>
  );
}
