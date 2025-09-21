/**
 * PdfViewer Component
 *
 * A comprehensive PDF viewer with zoom controls, pagination, search functionality,
 * and fullscreen support using react-pdf.
 *
 * Features:
 * - Zoom controls (25% - 200%)
 * - Page navigation with keyboard shortcuts
 * - Text search functionality
 * - Fullscreen mode
 * - Loading states and error handling
 * - Mobile-responsive design
 */

"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { ScrollArea } from "@/core/components/ui/scroll-area";
import {
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Search,
  Maximize2,
  Minimize2,
  RotateCw,
  // Loader2 and AlertCircle removed (no longer used)
} from "lucide-react";
import {
  PdfViewerProps,
  ViewerState,
  ZOOM_LEVELS,
  DEFAULT_ZOOM,
  FilePreviewError,
} from "@/types/files";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `/pdfjs-dist/5.3.93/build/pdf.worker.min.js`;

interface PdfViewerState extends ViewerState {
  numPages: number;
  currentPage: number;
  searchText: string;
  rotation: number;
}

interface ExtendedPdfViewerProps extends PdfViewerProps {
  onError?: (error: FilePreviewError) => void;
  onStateChange?: (state: Partial<ViewerState>) => void;
}

export default function PdfViewer({
  file,
  className = "",
  initialPage = 1,
  onPageChange,
  enableSearch = false,
  enableFullscreen = true,
  onError,
  onStateChange,
}: ExtendedPdfViewerProps) {
  const [pdfState, setPdfState] = useState<PdfViewerState>({
    loading: "loading",
    error: undefined,
    numPages: 0,
    currentPage: initialPage,
    zoom: DEFAULT_ZOOM,
    fullscreen: false,
    searchText: "",
    rotation: 0,
  });

  // Update parent state when local state changes
  useEffect(() => {
    if (onStateChange) {
      onStateChange({
        loading: pdfState.loading,
        error: pdfState.error,
        currentPage: pdfState.currentPage,
        totalPages: pdfState.numPages,
        zoom: pdfState.zoom,
        fullscreen: pdfState.fullscreen,
      });
    }
  }, [pdfState, onStateChange]);

  // Update local state
  const updateState = useCallback((updates: Partial<PdfViewerState>) => {
    setPdfState((prev) => ({ ...prev, ...updates }));
  }, []);

  // Handle document load success
  const onDocumentLoadSuccess = useCallback(
    ({ numPages }: { numPages: number }) => {
      updateState({
        numPages,
        loading: "success",
        error: undefined,
      });
    },
    [updateState]
  );

  // Handle document load error
  const onDocumentLoadError = useCallback(
    (error: Error) => {
      const pdfError: FilePreviewError = {
        code: "LOAD_ERROR",
        message: "No se pudo cargar el documento PDF",
        details: error.message,
      };

      updateState({
        loading: "error",
        error: pdfError,
      });

      if (onError) {
        onError(pdfError);
      }
    },
    [updateState, onError]
  );

  // Handle page change
  const handlePageChange = useCallback(
    (page: number) => {
      if (page >= 1 && page <= pdfState.numPages) {
        updateState({ currentPage: page });
        if (onPageChange) {
          onPageChange(page);
        }
      }
    },
    [pdfState.numPages, updateState, onPageChange]
  );

  // Handle zoom change
  const handleZoomChange = useCallback(
    (newZoom: number) => {
      const clampedZoom = Math.max(0.25, Math.min(2.0, newZoom));
      updateState({ zoom: clampedZoom });
    },
    [updateState]
  );

  // Handle zoom in
  const handleZoomIn = useCallback(() => {
    const currentZoom = pdfState.zoom ?? DEFAULT_ZOOM;
    const currentIndex = ZOOM_LEVELS.findIndex((level) => level >= currentZoom);
    const nextIndex = Math.min(currentIndex + 1, ZOOM_LEVELS.length - 1);
    handleZoomChange(ZOOM_LEVELS[nextIndex]);
  }, [pdfState.zoom, handleZoomChange]);

  // Handle zoom out
  const handleZoomOut = useCallback(() => {
    const currentZoom = pdfState.zoom ?? DEFAULT_ZOOM;
    const currentIndex = ZOOM_LEVELS.findIndex((level) => level >= currentZoom);
    const prevIndex = Math.max(currentIndex - 1, 0);
    handleZoomChange(ZOOM_LEVELS[prevIndex]);
  }, [pdfState.zoom, handleZoomChange]);

  // Handle rotation
  const handleRotate = useCallback(() => {
    updateState({ rotation: (pdfState.rotation + 90) % 360 });
  }, [pdfState.rotation, updateState]);

  // Handle fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    updateState({ fullscreen: !pdfState.fullscreen });
  }, [pdfState.fullscreen, updateState]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (pdfState.loading !== "success") return;

      switch (event.key) {
        case "ArrowLeft":
        case "PageUp":
          event.preventDefault();
          handlePageChange(pdfState.currentPage - 1);
          break;
        case "ArrowRight":
        case "PageDown":
          event.preventDefault();
          handlePageChange(pdfState.currentPage + 1);
          break;
        case "Home":
          event.preventDefault();
          handlePageChange(1);
          break;
        case "End":
          event.preventDefault();
          handlePageChange(pdfState.numPages);
          break;
        case "+":
        case "=":
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            handleZoomIn();
          }
          break;
        case "-":
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            handleZoomOut();
          }
          break;
        case "0":
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            handleZoomChange(DEFAULT_ZOOM);
          }
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    pdfState.loading,
    pdfState.currentPage,
    pdfState.numPages,
    handlePageChange,
    handleZoomIn,
    handleZoomOut,
    handleZoomChange,
  ]);

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Controls Toolbar */}
      <div className="flex items-center justify-between p-3 border-b bg-gray-50">
        <div className="flex items-center gap-2">
          {/* Page Navigation */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pdfState.currentPage - 1)}
              disabled={pdfState.currentPage <= 1}
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-2 px-3">
              <Input
                type="number"
                min={1}
                max={pdfState.numPages}
                value={pdfState.currentPage}
                onChange={(e) =>
                  handlePageChange(parseInt(e.target.value) || 1)
                }
                className="w-16 text-center text-sm"
                aria-label="Número de página"
              />
              <span className="text-sm text-gray-600">
                de {pdfState.numPages}
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pdfState.currentPage + 1)}
              disabled={pdfState.currentPage >= pdfState.numPages}
              aria-label="Página siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 ml-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleZoomOut}
              disabled={(pdfState.zoom ?? DEFAULT_ZOOM) <= 0.25}
              aria-label="Reducir zoom"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>

            <span className="px-3 text-sm text-gray-600 min-w-[4rem] text-center">
              {Math.round((pdfState.zoom ?? DEFAULT_ZOOM) * 100)}%
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={handleZoomIn}
              disabled={(pdfState.zoom ?? DEFAULT_ZOOM) >= 2.0}
              aria-label="Aumentar zoom"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>

          {/* Rotation */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRotate}
            aria-label="Rotar documento"
            className="ml-2"
          >
            <RotateCw className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          {enableSearch && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Buscar en documento..."
                  value={pdfState.searchText}
                  onChange={(e) => updateState({ searchText: e.target.value })}
                  className="pl-10 w-48 text-sm"
                />
              </div>
            </div>
          )}

          {/* Fullscreen */}
          {enableFullscreen && (
            <Button
              variant="outline"
              size="sm"
              onClick={toggleFullscreen}
              aria-label={
                pdfState.fullscreen
                  ? "Salir de pantalla completa"
                  : "Pantalla completa"
              }
            >
              {pdfState.fullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* PDF Document */}
      <ScrollArea className="h-full max-h-[80dvh]">
        <div className="flex justify-center p-4">
          <Document
            file={file.download_url}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={null}
            error={null}
            className="shadow-lg"
          >
            <Page
              pageNumber={pdfState.currentPage}
              scale={pdfState.zoom ?? DEFAULT_ZOOM}
              rotate={pdfState.rotation}
              loading={null}
              error={null}
              className="border border-gray-300"
            />
          </Document>
        </div>
      </ScrollArea>
    </div>
  );
}
