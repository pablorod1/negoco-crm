"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/core/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/core/components/ui/dialog";
import { Button } from "@/core/components/ui/button";
import { Loader2, X, RotateCcw, Stars, FileText } from "lucide-react";
import Image from "next/image";
import { useUser } from "@/core/contexts/UserContext";
import { ComparativaFile } from "@/comparativas/types";

interface AbarcaPanelProps {
  comparativaId: string;
  onStudyCompleted: () => void;
  files: Partial<ComparativaFile>[];
}

export function AbarcaPanel({
  comparativaId,
  onStudyCompleted,
  files,
}: AbarcaPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isFileModalOpen, setIsFileModalOpen] = useState(false);
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isIframeLoading, setIsIframeLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { userData } = useUser();

  const pdfFiles = files.filter(
    (file) => file.extension?.toLowerCase() === "pdf",
  );

  // Poll comparativa status while the panel is open
  useEffect(() => {
    if (!isOpen || !iframeUrl || !userData) return;

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/v2/comparisons/${comparativaId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: comparativaId,
            user_id: userData.id,
            user_role: userData.role,
          }),
        });
        if (!res.ok) return;
        const responseBody = (await res.json()) as {
          data?: { status?: string };
        };
        const comparativaStatus = responseBody.data?.status;

        if (!comparativaStatus || comparativaStatus === "pending") return;

        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }

        setIsOpen(false);
        setIframeUrl(null);
        onStudyCompleted();
      } catch {
        // Ignore polling errors
      }
    }, 5000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [isOpen, iframeUrl, comparativaId, onStudyCompleted, userData]);

  const fetchLoginUrl = useCallback(
    async (fileId?: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/v2/integrations/abarca/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            comparativa_id: comparativaId,
            ...(fileId ? { file_id: fileId } : {}),
          }),
        });

        if (!res.ok) {
          setError("No se pudo conectar con el comparador");
          return;
        }

        const data = await res.json();
        setIframeUrl(data.loginUrl);
        setIsIframeLoading(true);
        setIsOpen(true);
      } catch {
        setError("No se pudo conectar con el comparador");
      } finally {
        setIsLoading(false);
      }
    },
    [comparativaId],
  );

  const handleOpen = useCallback(() => {
    if (iframeUrl) {
      setIsOpen(true);
      return;
    }

    if (pdfFiles.length > 1) {
      setIsFileModalOpen(true);
      return;
    }

    const fileId = pdfFiles[0]?.id?.trim();
    if (pdfFiles.length === 1 && !fileId) {
      setError(
        "El PDF disponible no tiene un identificador válido y no se puede enviar.",
      );
      return;
    }

    fetchLoginUrl(fileId);
  }, [iframeUrl, pdfFiles, fetchLoginUrl]);

  const handleFileSelect = useCallback(
    (fileId?: string) => {
      const validFileId = fileId?.trim();
      if (!validFileId) {
        setError(
          "El PDF seleccionado no tiene un identificador válido y no se puede enviar.",
        );
        return;
      }

      setIsFileModalOpen(false);
      fetchLoginUrl(validFileId);
    },
    [fetchLoginUrl],
  );

  return (
    <>
      <Button
        onClick={handleOpen}
        variant="default"
        size="sm"
        className="w-full"
        disabled={isLoading}
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Conectando...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Stars className="h-4 w-4" />
            Estudio con IA
          </span>
        )}
      </Button>
      {error && !isOpen && !isFileModalOpen && (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {error}
        </p>
      )}

      {/* File selection modal */}
      <Dialog open={isFileModalOpen} onOpenChange={setIsFileModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Seleccionar factura</DialogTitle>
            <DialogDescription>
              Elige el PDF que quieres enviar al comparador energético.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-2">
            {pdfFiles.map((file) => {
              const fileId = file.id?.trim();

              return (
                <button
                  type="button"
                  key={file.id ?? file.download_url ?? file.filename}
                  onClick={() => handleFileSelect(fileId)}
                  disabled={!fileId}
                  className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-left transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FileText className="h-5 w-5 shrink-0 text-gray-400" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-gray-800">
                      {file.filename ?? "Documento PDF"}
                    </span>
                    {!fileId && (
                      <span className="block text-xs text-red-600">
                        Archivo sin identificador
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
            {pdfFiles.some((file) => !file.id?.trim()) && (
              <p role="alert" className="text-xs text-red-600">
                Los archivos sin identificador válido no se pueden seleccionar.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent
          side="right"
          className="!w-full sm:!w-[85vw] lg:!w-[75vw] !p-0 flex flex-col gap-0 !rounded-l-2xl overflow-hidden"
        >
          <SheetHeader className="px-6 py-4 bg-white shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-12">
                  <Image
                    src="/icons/negoco-ai.webp"
                    alt="Negoco Cloud IA Logo"
                    width={400}
                    height={400}
                  />
                </div>
                <div>
                  <SheetTitle className="text-base">
                    Comparador energético con IA
                  </SheetTitle>
                  <SheetDescription className="text-xs">
                    Negoco Cloud AI
                  </SheetDescription>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </SheetHeader>

          <div className="flex-1 h-full relative overflow-hidden">
            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
                <div className="flex flex-col items-center gap-3 text-center">
                  <p className="text-sm text-gray-600">{error}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchLoginUrl()}
                    className="gap-2"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reintentar
                  </Button>
                </div>
              </div>
            )}

            {iframeUrl && (
              <>
                {isIframeLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
                      <p className="text-sm text-gray-500">
                        Cargando comparador...
                      </p>
                    </div>
                  </div>
                )}
                <iframe
                  id="abarca-panel"
                  src={iframeUrl}
                  title="Comparador energético con IA"
                  sandbox="allow-same-origin allow-scripts allow-forms allow-downloads allow-popups"
                  className="abarca-panel w-full h-full border-0"
                  onLoad={() => setIsIframeLoading(false)}
                />
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
