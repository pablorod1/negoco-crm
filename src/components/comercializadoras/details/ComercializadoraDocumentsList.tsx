"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Download,
  Search,
  Calendar,
  Plus,
  CloudAlert,
} from "lucide-react";
import { formatDate, formatFileSize } from "@/lib/core/format";
import { DocumentacionFile } from "@/lib/core/types";
import Image from "next/image";
import { downloadFile } from "@/lib/firebase/data/downloadFile";
import { showCustomToast } from "@/components/core/CustomToast";

interface ComercializadoraDocumentsListProps {
  files: DocumentacionFile[];
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

export function ComercializadoraDocumentsList({
  files,
}: ComercializadoraDocumentsListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [documents] = useState<DocumentacionFile[]>(files || []);

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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Documentos
          </CardTitle>
          {/* <Button>
            <Plus className="h-4 w-4 mr-2" />
            Subir Documento
          </Button> */}
        </div>
      </CardHeader>

      <CardContent>
        {hasNoFiles ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
              <FileText className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">
              No hay documentos
            </h3>
            <p className="text-gray-500 mb-6 max-w-md">
              Esta comercializadora aún no tiene documentos subidos. Comienza
              subiendo el primer documento para gestionar la documentación.
            </p>
            <Button size="lg" className="gap-2">
              <Plus className="h-5 w-5" />
              Subir Primer Documento
            </Button>
          </div>
        ) : hasNoFilteredResults ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Search className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No se encontraron documentos
            </h3>
            <p className="text-sm text-gray-500 mb-4 max-w-sm">
              No hay documentos que coincidan con &quot;{searchTerm}&quot;.
              Intenta con otros términos de búsqueda.
            </p>
            <Button variant="outline" onClick={() => setSearchTerm("")}>
              Limpiar búsqueda
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredDocuments.map((document, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-4 flex-1">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <Image
                      src={getFileIcon(document) || "/file-icons/file.png"}
                      alt={document.name}
                      className="h-8 w-8 object-contain"
                      width={512}
                      height={512}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 truncate">
                      {document.name}
                    </h4>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        {formatFileSize(document.size)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(document.upload_date)}
                      </span>
                      <span className="uppercase text-xs font-medium">
                        {document.extension}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDownload(document)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
