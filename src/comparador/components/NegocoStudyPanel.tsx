"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Calculator, Loader2, RotateCcw, X } from "lucide-react";
import Image from "next/image";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/core/components/ui/sheet";
import { Button } from "@/core/components/ui/button";
import { NegocoStudy } from "./study/NegocoStudy";

type PanelState = "checking" | "ready" | "error";

export function NegocoStudyPanel({
  comparativaId,
  onCompleted,
}: {
  comparativaId: string;
  /** Al completar el estudio, para refrescar la comparativa. */
  onCompleted?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<PanelState>("checking");
  const request = useRef<AbortController | null>(null);

  const checkAccess = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setState("checking");

    try {
      const response = await fetch("/api/v2/comparador/status", {
        signal: controller.signal,
      });
      setState(response.ok ? "ready" : "error");
    } catch {
      if (!controller.signal.aborted) setState("error");
    }
  }, []);

  useEffect(() => () => request.current?.abort(), []);

  const handleOpenChange = (value: boolean) => {
    setOpen(value);
    if (value) void checkAccess();
    else request.current?.abort();
  };

  return (
    <>
      <Button
        onClick={() => handleOpenChange(true)}
        variant="outline"
        size="sm"
        className="w-full"
      >
        <Calculator className="h-4 w-4" />
        Estudio Negoco Cloud
      </Button>

      <Sheet open={open} onOpenChange={handleOpenChange}>
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
                    Estudio Negoco Cloud
                  </SheetTitle>
                  <SheetDescription className="text-xs">
                    Comparador propio · luz 2.0TD
                  </SheetDescription>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => handleOpenChange(false)}
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </SheetHeader>

          <div
            className={`flex-1 bg-gray-50 p-6 ${state === "ready" ? "overflow-y-auto" : "flex items-center justify-center"}`}
          >
            {state === "checking" && (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
                <p className="text-sm text-gray-500">Comprobando acceso...</p>
              </div>
            )}

            {state === "error" && (
              <div className="flex flex-col items-center gap-3 text-center">
                <p role="alert" className="text-sm text-gray-600">
                  No se pudo abrir el comparador.
                </p>
                <Button variant="outline" size="sm" onClick={checkAccess}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reintentar
                </Button>
              </div>
            )}

            {state === "ready" && (
              <NegocoStudy
                comparativaId={comparativaId}
                onCompleted={() => {
                  handleOpenChange(false);
                  onCompleted?.();
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
