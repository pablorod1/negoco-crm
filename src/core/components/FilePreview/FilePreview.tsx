/**
 * FilePreview Component
 *
 * A comprehensive file preview component that automatically detects file types
 * and renders the appropriate viewer component with unified controls and error handling.
 *
 * Features:
 * - Automatic file type detection
 * - Responsive design with mobile-first approach
 * - Unified error handling and loading states
 * - Keyboard navigation support
 * - ARIA accessibility labels
 */

"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/core/components/ui/dialog";
import { Button } from "@/core/components/ui/button";
import { Separator } from "@/core/components/ui/separator";
import { AlertCircle, Download, X, FileIcon, Loader2 } from "lucide-react";
import {
  FileData,
  FilePreviewProps,
  FileTypeDetection,
  detectFileType,
  ViewerState,
  FilePreviewError,
} from "@/types/files";
import { formatFileSize } from "@/core/utils/format";
import { downloadFile } from "@/core/firebase/data/downloadFile";
import { showCustomToast } from "@/core/components/CustomToast";

// Lazy load viewer components for better performance
const PdfViewer = React.lazy(() => import("./viewers/PdfViewer"));
const ImageViewer = React.lazy(() => import("./viewers/ImageViewer"));
const TextViewer = React.lazy(() => import("./viewers/TextViewer"));

/**
 * Main FilePreview component
 */
export default function FilePreview({
  file,
  onClose,
  className = "",
  isOpen = true,
}: FilePreviewProps) {
  const [viewerState, setViewerState] = useState<ViewerState>({
    loading: "idle",
    error: undefined,
    zoom: 1.0,
    fullscreen: false,
  });

  const [fileTypeInfo, setFileTypeInfo] = useState<FileTypeDetection | null>(
    null
  );

  // Detect file type on component mount or file change
  useEffect(() => {
    if (file) {
      const typeInfo = detectFileType(file);
      setFileTypeInfo(typeInfo);
      setViewerState((prev) => ({
        ...prev,
        loading: "loading", // Set to loading when file changes
        error: undefined,
      }));
    }
  }, [file]);

  // Update viewer state
  const updateViewerState = useCallback((updates: Partial<ViewerState>) => {
    setViewerState((prev) => ({ ...prev, ...updates }));
  }, []);

  // Toggle fullscreen mode
  const toggleFullscreen = useCallback(() => {
    updateViewerState({ fullscreen: !viewerState.fullscreen });
  }, [viewerState.fullscreen, updateViewerState]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      switch (event.key) {
        case "Escape":
          event.preventDefault();
          onClose();
          break;
        case "F11":
          event.preventDefault();
          toggleFullscreen();
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, toggleFullscreen]);

  // Handle file download
  const handleDownload = useCallback(async () => {
    if (!file.download_url) return;

    try {
      const { success, errors } = await downloadFile(
        file.download_url,
        file.filename
      );

      if (!success) {
        showCustomToast({
          title: "Error al descargar el archivo",
          message: errors,
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: AlertCircle,
        });
      }
    } catch {
      showCustomToast({
        title: "Error al descargar",
        message: "No se pudo descargar el archivo",
        iconColor: "var(--danger-color)",
        iconSize: 24,
        icon: AlertCircle,
      });
    }
  }, [file]);

  // Handle viewer errors
  const handleViewerError = useCallback(
    (error: FilePreviewError) => {
      updateViewerState({ loading: "error", error });
    },
    [updateViewerState]
  );

  // Render appropriate viewer based on file type
  const renderViewer = () => {
    if (!fileTypeInfo) return null;

    const viewerProps = {
      file,
      onClose,
      className: "w-full h-full",
      onError: handleViewerError,
      onStateChange: updateViewerState,
    };

    switch (fileTypeInfo.suggestedViewer) {
      case "pdf":
        return (
          <React.Suspense fallback={<ViewerLoadingState />}>
            <PdfViewer {...viewerProps} />
          </React.Suspense>
        );
      case "image":
        return (
          <React.Suspense fallback={<ViewerLoadingState />}>
            <ImageViewer {...viewerProps} />
          </React.Suspense>
        );
      case "text":
        return (
          <React.Suspense fallback={<ViewerLoadingState />}>
            <TextViewer {...viewerProps} />
          </React.Suspense>
        );
      default:
        return <UnsupportedFileView file={file} onDownload={handleDownload} />;
    }
  };

  // Render error state
  const renderError = () => {
    if (!viewerState.error) return null;

    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold text-gray-900">
            Error al cargar el archivo
          </h3>
          <p className="text-sm text-gray-600 max-w-md">
            {viewerState.error.message}
          </p>
          {viewerState.error.details && (
            <p className="text-xs text-gray-500 mt-2">
              {viewerState.error.details}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
            className="text-sm"
          >
            Reintentar
          </Button>
          <Button
            variant="outline"
            onClick={handleDownload}
            className="text-sm"
          >
            <Download className="h-4 w-4 mr-2" />
            Descargar
          </Button>
        </div>
      </div>
    );
  };

  if (!file || !fileTypeInfo) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={`
          max-w-7xl max-h-[90vh] p-0 gap-0
          ${viewerState.fullscreen ? "w-screen h-screen max-w-none max-h-none" : ""}
          ${className}
        `}
        aria-label={`Vista previa de ${file.filename}`}
        aria-describedby={undefined}
      >
        {/* Header */}
        <DialogHeader className="p-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <FileIcon className="h-5 w-5 text-gray-600 flex-shrink-0" />
              <div className="min-w-0">
                <DialogTitle className="text-sm font-medium text-gray-900 truncate">
                  {file.filename}
                </DialogTitle>
                <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                  <span>{file.extension.toUpperCase()}</span>
                  <Separator orientation="vertical" className="h-3" />
                  <span>{formatFileSize(file.size)}</span>
                  {fileTypeInfo && (
                    <>
                      <Separator orientation="vertical" className="h-3" />
                      <span
                        className={`
                        px-2 py-1 rounded text-xs font-medium
                        ${
                          fileTypeInfo.isSupported
                            ? "bg-green-100 text-green-800"
                            : "bg-yellow-100 text-yellow-800"
                        }
                      `}
                      >
                        {fileTypeInfo.isSupported
                          ? "Soportado"
                          : "No soportado"}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {file.download_url && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  className="text-gray-700 border-gray-300 hover:bg-gray-100"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Descargar
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Cerrar vista previa"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className=" overflow-hidden">
          {viewerState.loading === "error" ? renderError() : renderViewer()}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Loading state component for viewers
 */
function ViewerLoadingState({
  message = "Cargando vista previa...",
}: {
  message?: string;
}) {
  return (
    <div className="flex items-center justify-center h-96">
      <div className="flex flex-col items-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-sm text-gray-600">{message}</p>
      </div>
    </div>
  );
}

/**
 * Unsupported file type component
 */
function UnsupportedFileView({
  file,
  onDownload,
}: {
  file: FileData;
  onDownload: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-96 space-y-4">
      <FileIcon className="h-16 w-16 text-gray-400" />
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold text-gray-900">
          Formato no soportado
        </h3>
        <p className="text-sm text-gray-600 max-w-md">
          La vista previa no está disponible para archivos{" "}
          {file.extension.toUpperCase()}. Puedes descargar el archivo para verlo
          en tu aplicación preferida.
        </p>
      </div>
      <Button
        onClick={onDownload}
        className="bg-blue-600 hover:bg-blue-700 text-white"
      >
        <Download className="h-4 w-4 mr-2" />
        Descargar archivo
      </Button>
    </div>
  );
}
