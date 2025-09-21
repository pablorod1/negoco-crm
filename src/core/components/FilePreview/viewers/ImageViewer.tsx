/**
 * ImageViewer Component
 *
 * A comprehensive image viewer with zoom, rotation, and navigation capabilities
 * using react-photo-view for lightbox functionality.
 *
 * Features:
 * - Zoom controls with mouse wheel support
 * - Image rotation (90-degree increments)
 * - Navigation between multiple images
 * - Fullscreen lightbox mode
 * - Touch gesture support for mobile
 * - Loading states and error handling
 */

"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { PhotoProvider, PhotoView } from "react-photo-view";
import Image from "next/image";
import { Button } from "@/core/components/ui/button";
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import {
  ImageViewerProps,
  ViewerState,
  FilePreviewError,
  DEFAULT_ZOOM,
  ZOOM_LEVELS,
} from "@/types/files";

// Import react-photo-view styles
import "react-photo-view/dist/react-photo-view.css";
import { ScrollArea } from "../../ui/scroll-area";

interface ImageViewerState extends ViewerState {
  rotation: number;
  imageLoaded: boolean;
  naturalWidth: number;
  naturalHeight: number;
}

interface ExtendedImageViewerProps extends ImageViewerProps {
  onError?: (error: FilePreviewError) => void;
  onStateChange?: (state: Partial<ViewerState>) => void;
}

export default function ImageViewer({
  file,
  images = [file],
  initialIndex = 0,
  enableRotation = true,
  enableZoom = true,
  onError,
  onStateChange,
  className = "",
}: ExtendedImageViewerProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageState, setImageState] = useState<ImageViewerState>({
    loading: "loading",
    error: undefined,
    zoom: DEFAULT_ZOOM,
    fullscreen: false,
    rotation: 0,
    imageLoaded: false,
    naturalWidth: 0,
    naturalHeight: 0,
  });

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const currentImage = images[currentIndex] || file;

  // Update parent state when local state changes
  useEffect(() => {
    if (onStateChange) {
      onStateChange({
        loading: imageState.loading,
        error: imageState.error,
        zoom: imageState.zoom,
        fullscreen: imageState.fullscreen,
      });
    }
  }, [imageState, onStateChange]);

  // Update local state
  const updateState = useCallback((updates: Partial<ImageViewerState>) => {
    setImageState((prev) => ({ ...prev, ...updates }));
  }, []);

  // Handle image load success
  const handleImageLoad = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      const img = event.currentTarget;
      updateState({
        loading: "success",
        error: undefined,
        imageLoaded: true,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
      });
    },
    [updateState]
  );

  // Handle image load error
  const handleImageError = useCallback(() => {
    const imageError: FilePreviewError = {
      code: "LOAD_ERROR",
      message: "No se pudo cargar la imagen",
      details: `Error al cargar: ${currentImage.filename}`,
    };

    updateState({
      loading: "error",
      error: imageError,
      imageLoaded: false,
    });

    if (onError) {
      onError(imageError);
    }
  }, [updateState, onError, currentImage.filename]);

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
    const currentZoom = imageState.zoom ?? DEFAULT_ZOOM;
    const currentZoomIndex = ZOOM_LEVELS.findIndex(
      (level) => level >= currentZoom
    );
    const nextIndex = Math.min(currentZoomIndex + 1, ZOOM_LEVELS.length - 1);
    handleZoomChange(ZOOM_LEVELS[nextIndex]);
  }, [imageState.zoom, handleZoomChange]);

  // Handle zoom out
  const handleZoomOut = useCallback(() => {
    const currentZoom = imageState.zoom ?? DEFAULT_ZOOM;
    const currentZoomIndex = ZOOM_LEVELS.findIndex(
      (level) => level >= currentZoom
    );
    const prevIndex = Math.max(currentZoomIndex - 1, 0);
    handleZoomChange(ZOOM_LEVELS[prevIndex]);
  }, [imageState.zoom, handleZoomChange]);

  // Handle rotation
  const handleRotate = useCallback(() => {
    updateState({ rotation: (imageState.rotation + 90) % 360 });
  }, [imageState.rotation, updateState]);

  // Handle navigation between images
  const handlePrevious = useCallback(() => {
    if (images.length > 1) {
      const newIndex = currentIndex > 0 ? currentIndex - 1 : images.length - 1;
      setCurrentIndex(newIndex);
      updateState({ loading: "loading", rotation: 0, zoom: DEFAULT_ZOOM });
    }
  }, [currentIndex, images.length, updateState]);

  const handleNext = useCallback(() => {
    if (images.length > 1) {
      const newIndex = currentIndex < images.length - 1 ? currentIndex + 1 : 0;
      setCurrentIndex(newIndex);
      updateState({ loading: "loading", rotation: 0, zoom: DEFAULT_ZOOM });
    }
  }, [currentIndex, images.length, updateState]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (lightboxOpen) return; // Let lightbox handle keys when open

      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault();
          handlePrevious();
          break;
        case "ArrowRight":
          event.preventDefault();
          handleNext();
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
        case "r":
        case "R":
          if (enableRotation) {
            event.preventDefault();
            handleRotate();
          }
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    lightboxOpen,
    handlePrevious,
    handleNext,
    handleZoomIn,
    handleZoomOut,
    handleZoomChange,
    handleRotate,
    enableRotation,
  ]);

  // Reset state when image changes
  useEffect(() => {
    updateState({
      loading: "loading",
      error: undefined,
      imageLoaded: false,
      rotation: 0,
      zoom: DEFAULT_ZOOM,
    });
  }, [currentImage.id, updateState]);

  // Render error state only - loading is handled by parent
  if (imageState.loading === "error") {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold text-gray-900">
            Error al cargar imagen
          </h3>
          <p className="text-sm text-gray-600 max-w-md">
            {imageState.error?.message}
          </p>
          {imageState.error?.details && (
            <p className="text-xs text-gray-500 mt-2">
              {imageState.error.details}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          onClick={() => window.location.reload()}
          className="text-sm"
        >
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Controls Toolbar */}
      <div className="flex items-center justify-between p-3 border-b bg-gray-50">
        <div className="flex items-center gap-2">
          {/* Navigation for multiple images */}
          {images.length > 1 && (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevious}
                aria-label="Imagen anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <span className="px-3 text-sm text-gray-600">
                {currentIndex + 1} de {images.length}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={handleNext}
                aria-label="Imagen siguiente"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Zoom Controls */}
          {enableZoom && (
            <div className="flex items-center gap-1 ml-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleZoomOut}
                disabled={(imageState.zoom ?? DEFAULT_ZOOM) <= 0.25}
                aria-label="Reducir zoom"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>

              <span className="px-3 text-sm text-gray-600 min-w-[4rem] text-center">
                {Math.round((imageState.zoom ?? DEFAULT_ZOOM) * 100)}%
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={handleZoomIn}
                disabled={(imageState.zoom ?? DEFAULT_ZOOM) >= 2.0}
                aria-label="Aumentar zoom"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Rotation */}
          {enableRotation && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRotate}
              aria-label="Rotar imagen"
              className="ml-2"
            >
              <RotateCw className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Image Info */}
          {imageState.imageLoaded && (
            <span className="text-xs text-gray-500">
              {imageState.naturalWidth} × {imageState.naturalHeight}
            </span>
          )}

          {/* Lightbox Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLightboxOpen(true)}
            aria-label="Ver en pantalla completa"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Image Display */}
      <ScrollArea className="max-h-[80dvh] h-full">
        <div className=" flex items-center justify-center p-4 bg-gray-100">
          <div
            className="relative "
            style={{
              transform: `scale(${imageState.zoom ?? DEFAULT_ZOOM}) rotate(${imageState.rotation}deg)`,
              transition: "transform 0.2s ease-in-out",
            }}
          >
            <Image
              ref={imageRef}
              src={currentImage.download_url || currentImage.preview_url || ""}
              alt={currentImage.filename}
              width={800}
              height={600}
              className="max-w-full max-h-full object-contain shadow-lg w-auto h-auto"
              onLoad={handleImageLoad}
              onError={handleImageError}
              priority
              unoptimized // For external URLs
            />
          </div>
        </div>
      </ScrollArea>

      {/* Lightbox */}
      <PhotoProvider
        speed={() => 300}
        onVisibleChange={(visible) => setLightboxOpen(visible)}
      >
        {lightboxOpen && (
          <PhotoView
            src={currentImage.download_url || currentImage.preview_url || ""}
          >
            <div className="hidden" />
          </PhotoView>
        )}
      </PhotoProvider>
    </div>
  );
}
