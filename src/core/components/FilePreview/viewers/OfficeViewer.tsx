/**
 * OfficeViewer Component
 *
 * A comprehensive Office document viewer that converts documents to PDF
 * for preview using a backend conversion API.
 *
 * Features:
 * - Automatic conversion to PDF via API
 * - Fallback to download if conversion fails
 * - Loading states with progress indication
 * - Error handling with retry functionality
 * - Support for Word, Excel, PowerPoint documents
 * - Embedded PDF viewer for converted documents
 */

"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Button } from "@/core/components/ui/button";
import {
  Download,
  RefreshCw,
  Loader2,
  AlertCircle,
  FileSpreadsheet,
  FileText as FileTextIcon,
  Presentation,
  CheckCircle,
} from "lucide-react";
import {
  OfficeViewerProps,
  ViewerState,
  FilePreviewError,
  ConversionResponse,
  FileData,
} from "@/types/files";
import PdfViewer from "./PdfViewer";

interface OfficeViewerState extends ViewerState {
  conversionStatus: "idle" | "converting" | "converted" | "failed";
  convertedFile?: FileData;
  conversionProgress: number;
  retryCount: number;
}

interface ExtendedOfficeViewerProps extends OfficeViewerProps {
  onError?: (error: FilePreviewError) => void;
  onStateChange?: (state: Partial<ViewerState>) => void;
}

// Get appropriate icon for office file type
const getOfficeIcon = (extension: string) => {
  const ext = extension.toLowerCase();
  switch (ext) {
    case ".xlsx":
    case ".xls":
      return FileSpreadsheet;
    case ".pptx":
    case ".ppt":
      return Presentation;
    case ".docx":
    case ".doc":
    default:
      return FileTextIcon;
  }
};

// Get file type name for display
const getFileTypeName = (extension: string) => {
  const ext = extension.toLowerCase();
  switch (ext) {
    case ".xlsx":
    case ".xls":
      return "Excel";
    case ".pptx":
    case ".ppt":
      return "PowerPoint";
    case ".docx":
    case ".doc":
      return "Word";
    default:
      return "Office";
  }
};

export default function OfficeViewer({
  file,
  conversionEndpoint = "/api/v2/files/convert-office",
  fallbackToDownload = true,
  onError,
  onStateChange,
  className = "",
}: ExtendedOfficeViewerProps) {
  const [officeState, setOfficeState] = useState<OfficeViewerState>({
    loading: "idle",
    error: undefined,
    conversionStatus: "idle",
    conversionProgress: 0,
    retryCount: 0,
  });

  const IconComponent = getOfficeIcon(file.extension);
  const fileTypeName = getFileTypeName(file.extension);

  // Update parent state when local state changes
  useEffect(() => {
    if (onStateChange) {
      onStateChange({
        loading: officeState.loading,
        error: officeState.error,
      });
    }
  }, [officeState, onStateChange]);

  // Update local state
  const updateState = useCallback((updates: Partial<OfficeViewerState>) => {
    setOfficeState((prev) => ({ ...prev, ...updates }));
  }, []);

  // Convert office document to PDF
  const convertToPdf = useCallback(async () => {
    try {
      updateState({
        loading: "loading",
        conversionStatus: "converting",
        conversionProgress: 10,
        error: undefined,
      });

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setOfficeState((prev) => ({
          ...prev,
          conversionProgress: Math.min(prev.conversionProgress + 10, 90),
        }));
      }, 500);

      const formData = new FormData();
      formData.append("fileUrl", file.download_url);
      formData.append("filename", file.filename);
      formData.append("extension", file.extension);

      const response = await fetch(conversionEndpoint, {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        throw new Error(
          `Conversion failed: ${response.status} ${response.statusText}`
        );
      }

      const result: ConversionResponse = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Conversion failed");
      }

      if (!result.convertedUrl) {
        throw new Error("No converted file URL received");
      }

      // Create a FileData object for the converted PDF
      const convertedFile: FileData = {
        id: `${file.id}_converted`,
        filename: result.convertedFilename || `${file.filename}.pdf`,
        extension: ".pdf",
        size: file.size, // We don't know the converted size
        download_url: result.convertedUrl,
        upload_date: file.upload_date,
        type: "pdf",
      };

      updateState({
        loading: "success",
        conversionStatus: "converted",
        convertedFile,
        conversionProgress: 100,
        error: undefined,
      });
    } catch (error) {
      const conversionError: FilePreviewError = {
        code: "CONVERSION_ERROR",
        message: "No se pudo convertir el documento a PDF",
        details: error instanceof Error ? error.message : "Error desconocido",
      };

      updateState({
        loading: "error",
        conversionStatus: "failed",
        error: conversionError,
        retryCount: officeState.retryCount + 1,
      });

      if (onError) {
        onError(conversionError);
      }
    }
  }, [file, conversionEndpoint, updateState, onError, officeState.retryCount]);

  // Handle retry conversion
  const handleRetry = useCallback(() => {
    if (officeState.retryCount < 3) {
      convertToPdf();
    }
  }, [officeState.retryCount, convertToPdf]);

  // Handle fallback download
  const handleDownload = useCallback(async () => {
    try {
      const link = document.createElement("a");
      link.href = file.download_url;
      link.download = file.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      // Error during download
    }
  }, [file]);

  // Start conversion on component mount
  useEffect(() => {
    if (officeState.conversionStatus === "idle") {
      convertToPdf();
    }
  }, [convertToPdf, officeState.conversionStatus]);

  // Render conversion in progress
  if (officeState.conversionStatus === "converting") {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-6">
        <div className="flex flex-col items-center space-y-4">
          <IconComponent className="h-16 w-16 text-blue-600" />
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold text-gray-900">
              Convirtiendo documento {fileTypeName}
            </h3>
            <p className="text-sm text-gray-600">
              Preparando el documento para vista previa...
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full max-w-md">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
            <span>Progreso</span>
            <span>{officeState.conversionProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${officeState.conversionProgress}%` }}
            />
          </div>
        </div>

        <div className="flex items-center space-x-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Esto puede tardar unos momentos...</span>
        </div>
      </div>
    );
  }

  // Render conversion success - show PDF viewer
  if (
    officeState.conversionStatus === "converted" &&
    officeState.convertedFile
  ) {
    return (
      <div className={`flex flex-col h-full ${className}`}>
        {/* Success Banner */}
        <div className="flex items-center gap-2 p-3 bg-green-50 border-b border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <span className="text-sm text-green-800">
            Documento convertido exitosamente
          </span>
          <div className="ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="text-xs"
            >
              <Download className="h-3 w-3 mr-1" />
              Descargar original
            </Button>
          </div>
        </div>

        {/* PDF Viewer */}
        <div className="flex-1">
          <PdfViewer
            file={officeState.convertedFile}
            onClose={() => {}} // No-op as this is embedded
            className="h-full"
            enableSearch={true}
            enableFullscreen={true}
            onError={onError}
            onStateChange={onStateChange}
          />
        </div>
      </div>
    );
  }

  // Render conversion failed
  if (officeState.conversionStatus === "failed") {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-6">
        <div className="flex flex-col items-center space-y-4">
          <AlertCircle className="h-16 w-16 text-red-500" />
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold text-gray-900">
              Error en la conversión
            </h3>
            <p className="text-sm text-gray-600 max-w-md">
              {officeState.error?.message}
            </p>
            {officeState.error?.details && (
              <p className="text-xs text-gray-500 mt-2">
                {officeState.error.details}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          {/* Retry Button */}
          {officeState.retryCount < 3 && (
            <Button variant="outline" onClick={handleRetry} className="text-sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Reintentar ({3 - officeState.retryCount} intentos restantes)
            </Button>
          )}

          {/* Download Fallback */}
          {fallbackToDownload && (
            <Button
              onClick={handleDownload}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm"
            >
              <Download className="h-4 w-4 mr-2" />
              Descargar documento
            </Button>
          )}
        </div>

        <div className="text-center max-w-md">
          <p className="text-xs text-gray-500">
            La vista previa no está disponible para este documento. Puedes
            descargarlo para abrirlo en {fileTypeName} u otra aplicación
            compatible.
          </p>
        </div>
      </div>
    );
  }

  // Default loading state
  return (
    <div className="flex items-center justify-center h-96">
      <div className="flex flex-col items-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-sm text-gray-600">Preparando documento...</p>
      </div>
    </div>
  );
}
