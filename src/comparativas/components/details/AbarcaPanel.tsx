"use client";

import { useCallback, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/core/components/ui/sheet";
import { Button } from "@/core/components/ui/button";
import { Loader2, X, RotateCcw, Stars } from "lucide-react";
import Image from "next/image";

interface AbarcaPanelProps {
  comparativaId: string;
  userId: string;
  abarcaUserId: number;
}

export function AbarcaPanel({
  comparativaId,
  userId,
  abarcaUserId,
}: AbarcaPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isIframeLoading, setIsIframeLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLoginUrl = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v2/integrations/abarca/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ide: 100,
          idcm: abarcaUserId,
          comparativa_id: comparativaId,
          user_id: userId,
        }),
      });

      if (!res.ok) {
        console.error("Error fetching Abarca login URL:", await res.text());
        setError("No se pudo conectar con Abarca");
        return;
      }

      const data = await res.json();
      setIframeUrl(data.loginUrl);
      setIsIframeLoading(true);
    } catch {
      setError("Error de conexión con Abarca");
    } finally {
      setIsLoading(false);
    }
  }, [abarcaUserId, comparativaId, userId]);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    if (!iframeUrl) {
      fetchLoginUrl();
    }
  }, [iframeUrl, fetchLoginUrl]);

  return (
    <>
      <Button
        onClick={handleOpen}
        variant="default"
        size="sm"
        className="w-full"
      >
        <span className="flex items-center gap-2">
          <Stars className="h-4 w-4 " />
          Realizar estudio con IA
        </span>
      </Button>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent
          side="right"
          className="!w-full sm:!w-[85vw] lg:!w-[75vw] !p-0 flex flex-col gap-0 !rounded-l-2xl overflow-hidden"
        >
          {/* Header con branding de integración */}
          <SheetHeader className="px-6 py-4  bg-white shrink-0">
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
                    Comparador Energético
                  </SheetTitle>
                  <SheetDescription className="text-xs">
                    Integración con Abarca IA
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

          {/* Contenido del iframe */}
          <div className="flex-1 h-full relative overflow-hidden">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80 z-10">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
                  <p className="text-sm text-gray-500">
                    Conectando con Abarca...
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
                <div className="flex flex-col items-center gap-3 text-center">
                  <p className="text-sm text-gray-600">{error}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchLoginUrl}
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
                  title="Comparador Energético Abarca"
                  className="abarca-panel w-full h-full min-h-dvh border-0 absolute -top-20 left-0"
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
