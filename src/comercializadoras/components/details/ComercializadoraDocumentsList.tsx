"use client";

import { useState } from "react";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { FileText, Download, Search, Calendar, CloudAlert } from "lucide-react";
import { formatDate, formatFileSize } from "@/core/utils/format";
import { ComercializadoraDetails } from "@/comercializadoras/types";
import { DocumentacionFile, User } from "@/core/types";
import Image from "next/image";
import { downloadFile } from "@/core/firebase/data/downloadFile";
import { showCustomToast } from "@/core/components/CustomToast";
import UploadComercializadoraFilesDialog from "./UploadComercializadoraFilesDialog";
import { uploadDocumentLibraryFiles } from "@/documentacion/lib/uploadDocumentLibraryFiles";

interface ComercializadoraDocumentsListProps {
  files: DocumentacionFile[];
  comercializadora: ComercializadoraDetails;
  userData: User;
  refetch: () => void;
}

const getFileIcon = (file: DocumentacionFile) => {
  switch (file.extension) {
    case "pdf":
      return "/file-icons/pdf.png";
    case "doc":
    case "docx":
      return "/file-icons/word.png";
    case "xls":
    case "xlsx":
      return "/file-icons/excel.png";
    case "ppt":
    case "pptx":
      return "/file-icons/powerpoint.png";
    case "jpg":
    case "JPG":
    case "jpeg":
    case "png":
    case "webp":
    case "svg":
    case "gif":
      return file.preview_url;
    case "zip":
    case "rar":
      return "/file-icons/zip.png";
    case "txt":
      return "/file-icons/txt.png";
    default:
      return "/file-icons/file.png";
  }
};

const getFileTypeColor = (extension: string) => {
  switch (extension.toLowerCase()) {
    case "pdf":
      return "bg-gray-100 text-gray-700";
    case "doc":
    case "docx":
      return "bg-gray-100 text-gray-700";
    case "xls":
    case "xlsx":
      return "bg-gray-100 text-gray-700";
    case "jpg":
    case "jpeg":
    case "png":
    case "gif":
    case "webp":
      return "bg-gray-100 text-gray-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
};

export function ComercializadoraDocumentsList({
  files,
  comercializadora,
  userData,
  refetch,
}: ComercializadoraDocumentsListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [documents] = useState<DocumentacionFile[]>(files || []);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const isComercial = userData.role === "2";

  const filteredDocuments = documents.filter((doc) =>
    doc.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const hasNoFiles = !documents || documents.length === 0;
  const hasNoFilteredResults = !hasNoFiles && filteredDocuments.length === 0;

  const handleDownload = async (file: DocumentacionFile) => {
    try {
      const response = await downloadFile(file.download_url, file.name);

      if (!response.success) {
        showCustomToast({
          title: "Error al descargar",
          message: response.errors || "No se pudo descargar el archivo.",
          icon: CloudAlert,
          iconColor: "var(--danger-color)",
          iconSize: 24,
        });
        return;
      }

      showCustomToast({
        title: "Descarga exitosa",
        message: `El archivo ${file.name} se ha descargado correctamente.`,
        icon: Download,
        iconColor: "var(--success-color)",
        iconSize: 24,
      });
    } catch (error) {
      console.error("Error downloading file:", error);
      showCustomToast({
        title: "Error al descargar",
        message:
          "No se pudo descargar el archivo. Inténtalo de nuevo más tarde.",
        icon: CloudAlert,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
    }
  };

  const handleUploadFile = async () => {
    setLoading(true);
    try {
      await uploadDocumentLibraryFiles({
        files: uploadedFiles,
        folderName: comercializadora.name,
        organizationId: userData?.organization.id as string,
      });

      showCustomToast({
        title: "Documentos subidos",
        message: "Los documentos se han subido correctamente.",
        icon: Download,
        iconColor: "var(--success-color)",
        iconSize: 24,
      });
      setUploadedFiles([]);
      refetch();
    } catch (error) {
      console.error("Error uploading file:", error);
      showCustomToast({
        title: "Error al subir documento",
        message: "Ocurrió un error al intentar subir el documento.",
        icon: CloudAlert,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Documentos</h3>
          <p className="text-sm text-gray-500 mt-1">
            {documents.length > 0 ? (
              <>
                <span className="font-medium text-gray-700">
                  {documents.length}
                </span>{" "}
                documento{documents.length !== 1 ? "s" : ""} disponible
                {documents.length !== 1 ? "s" : ""}
              </>
            ) : (
              "Sin documentos disponibles"
            )}
          </p>
        </div>
        {!hasNoFiles && !isComercial && (
          <UploadComercializadoraFilesDialog
            uploadedFiles={uploadedFiles}
            setUploadedFiles={setUploadedFiles}
            onUpload={handleUploadFile}
            loading={loading}
            buttonText="Subir"
          />
        )}
      </div>

      {!hasNoFiles && (
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar documentos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-white border-gray-200 focus:border-gray-300 focus:ring-gray-100"
          />
        </div>
      )}

      {hasNoFiles ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center mx-auto mb-4 shadow-sm border">
            <FileText className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Sin documentos
          </h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            Esta comercializadora no tiene documentos asociados.
          </p>
          {!isComercial && (
            <UploadComercializadoraFilesDialog
              uploadedFiles={uploadedFiles}
              setUploadedFiles={setUploadedFiles}
              onUpload={handleUploadFile}
              loading={loading}
            />
          )}
        </div>
      ) : hasNoFilteredResults ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center mx-auto mb-4 shadow-sm border">
            <Search className="h-6 w-6 text-gray-400" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-2">
            Sin resultados
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            No hay documentos que coincidan con &quot;{searchTerm}&quot;
          </p>
          <Button variant="outline" size="sm" onClick={() => setSearchTerm("")}>
            Limpiar búsqueda
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-100">
            {filteredDocuments.map((document, index) => (
              <div
                key={index}
                className="group p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <div className="w-10 h-10 bg-gray-50 rounded-lg p-2 border border-gray-200 flex-shrink-0">
                      <Image
                        src={getFileIcon(document) || "/file-icons/file.png"}
                        alt={document.name}
                        className="w-full h-full object-contain"
                        width={40}
                        height={40}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 truncate">
                        {document.name}
                      </h4>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-sm text-gray-500">
                          {formatFileSize(document.size)}
                        </span>
                        <span className="flex items-center gap-1 text-sm text-gray-500">
                          <Calendar className="h-3 w-3" />
                          {formatDate(document.upload_date)}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded ${getFileTypeColor(
                            document.extension
                          )}`}
                        >
                          {document.extension.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(document)}
                    className="opacity-60 group-hover:opacity-100 hover:bg-gray-100 transition-all"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
