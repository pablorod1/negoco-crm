"use client";

import { useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/core/components/ui/dialog";
import { Label } from "@/core/components/ui/label";
import { Textarea } from "@/core/components/ui/textarea";
import { ratesApi } from "./api";

type Step = "idle" | "uploading" | "processing";

const ACCEPT = ".pdf,.xlsx,.xlsm,.xls,.csv,.png,.jpg,.jpeg,.webp";

/**
 * Subida manual de un anexo: un archivo o el texto pegado de un correo. Al
 * subirlo se procesa (clasificación y extracción con IA) y se abre la revisión.
 */
export function RateUploadDialog({
  open,
  onOpenChange,
  comercializadoraId,
  supplierName,
  onProcessed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comercializadoraId: string;
  supplierName: string;
  onProcessed: (ingestId: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setFile(null);
    setText("");
    setStep("idle");
    setError(null);
  };

  const submit = async () => {
    setError(null);
    const form = new FormData();
    form.set("comercializadora_id", comercializadoraId);
    if (file) form.set("file", file);
    else form.set("text", text);

    let ingestId: string | null = null;
    try {
      setStep("uploading");
      ({ id: ingestId } = await ratesApi.upload(form));
      setStep("processing");
      await ratesApi.process(ingestId);
      reset();
      onOpenChange(false);
      onProcessed(ingestId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se ha podido procesar");
      setStep("idle");
      // El documento ya está guardado: se puede revisar o reprocesar desde la lista.
      if (ingestId) onProcessed(ingestId);
    }
  };

  const busy = step !== "idle";

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (busy) return;
        if (!value) reset();
        onOpenChange(value);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Subir anexo de precios · {supplierName}</DialogTitle>
          <DialogDescription>
            PDF, Excel, CSV o imagen, o el texto del correo. Se leen los precios 2.0TD
            de precio fijo y las comisiones; nada cambia hasta que apruebes la revisión.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rate-file">Archivo</Label>
            <input
              id="rate-file"
              type="file"
              accept={ACCEPT}
              disabled={busy}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5"
            />
          </div>
          {!file && (
            <div className="space-y-2">
              <Label htmlFor="rate-text">O pega el texto del correo</Label>
              <Textarea
                id="rate-text"
                rows={6}
                disabled={busy}
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="PRECIOS FIJOS ELECTRICIDAD (válidos desde…)"
              />
            </div>
          )}
          {error && <p className="text-sm text-danger">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={busy || (!file && !text.trim())} onClick={submit}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
            {step === "uploading"
              ? "Subiendo…"
              : step === "processing"
                ? "Leyendo precios…"
                : "Subir y leer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
