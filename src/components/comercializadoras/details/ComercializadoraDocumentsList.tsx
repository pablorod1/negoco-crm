"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Download, Search, Calendar, CloudAlert } from "lucide-react";
import { formatDate, formatFileSize } from "@/lib/core/format";
import {
  ComercializadoraDetails,
  DocumentacionFile,
  User,
} from "@/lib/core/types";
import Image from "next/image";
import { downloadFile } from "@/lib/firebase/data/downloadFile";
import { showCustomToast } from "@/components/core/CustomToast";
import UploadComercializadoraFilesDialog from "./UploadComercializadoraFilesDialog";

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
      return "bg-red-100 text-red-700 border-red-200";
    case "doc":
    case "docx":
      return "bg-primary-100 text-primary-700 border-primary-200";
    case "xls":
    case "xlsx":
      return "bg-green-100 text-green-700 border-green-200";
    case "jpg":
    case "jpeg":
    case "png":
    case "gif":
    case "webp":
      return "bg-purple-100 text-purple-700 border-purple-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
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
      const formData = new FormData();
      uploadedFiles.forEach((file) => {
        formData.append("files", file);
      });
      formData.append("folder_name", comercializadora.name);
      formData.append("organization_id", userData?.organization.id as string);
      const response = await fetch("/api/documentacion/add", {
        method: "POST",
        body: formData,
      });
      const { success, error } = await response.json();

      if (!success) {
        console.error("Error uploading files:", error);
        showCustomToast({
          title: "Error al subir documentos",
          message: error || "No se pudieron subir los documentos.",
          icon: CloudAlert,
          iconColor: "var(--danger-color)",
          iconSize: 24,
        });
        return;
      }

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
    <div className="space-y-6">
      {!hasNoFiles && (
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar documentos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white border-gray-300 focus:border-primary-500 focus:ring-primary-500"
            />
          </div>
          <div className="flex items-center gap-2">
            {!isComercial ? (
              <UploadComercializadoraFilesDialog
                uploadedFiles={uploadedFiles}
                setUploadedFiles={setUploadedFiles}
                onUpload={handleUploadFile}
                loading={loading}
                buttonText="Subir documentos"
              />
            ) : null}
          </div>
        </div>
      )}

      {hasNoFiles ? (
        <div className="text-center py-16">
          <div className="w-24 h-24 bg-primary-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <FileText className="h-12 w-12 text-primary-500" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-3">
            No hay documentos
          </h3>
          <p className="text-gray-500 mb-8 max-w-md mx-auto">
            Esta comercializadora aún no tiene documentos subidos. Comienza
            subiendo el primer documento para gestionar la documentación.
          </p>
          {!isComercial ? (
            <UploadComercializadoraFilesDialog
              uploadedFiles={uploadedFiles}
              setUploadedFiles={setUploadedFiles}
              onUpload={handleUploadFile}
              loading={loading}
            />
          ) : null}
        </div>
      ) : hasNoFilteredResults ? (
        <div className="text-center py-12">
          <div className="w-20 h-20 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Search className="h-10 w-10 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No se encontraron documentos
          </h3>
          <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
            No hay documentos que coincidan con &quot;{searchTerm}&quot;.
            Intenta con otros términos de búsqueda.
          </p>
          <Button variant="outline" onClick={() => setSearchTerm("")}>
            Limpiar búsqueda
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredDocuments.map((document, index) => (
            <div
              key={index}
              className="group bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md hover:border-primary-300 transition-all duration-200"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4 flex-1 min-w-0">
                  <div className="relative">
                    <div className="w-12 h-12 bg-gray-50 rounded-lg p-2 border border-gray-200 group-hover:border-primary-300 transition-colors">
                      <Image
                        src={getFileIcon(document) || "/file-icons/file.png"}
                        alt={document.name}
                        className="w-full h-full object-contain"
                        width={512}
                        height={512}
                      />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 truncate group-hover:text-primary-700 transition-colors">
                      {document.name}
                    </h4>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-sm text-gray-500">
                        {formatFileSize(document.size)}
                      </span>
                      <span className="flex items-center gap-1 text-sm text-gray-500">
                        <Calendar className="h-3 w-3" />
                        {formatDate(document.upload_date)}
                      </span>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-md border ${getFileTypeColor(
                          document.extension
                        )}`}
                      >
                        {document.extension.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(document)}
                    className="opacity-70 group-hover:opacity-100 hover:bg-primary-50 hover:text-primary-700 transition-all"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Descargar
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
