"use client";

import { useEffect, useState } from "react";
import { Check, FileText, Loader2, ShieldCheck, Upload, X } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import type { ComparativaStudies } from "./api";

const PHASES = [
  { label: "Leyendo la factura", after: 0 },
  { label: "Tapando los datos personales", after: 4 },
  { label: "Consultando el consumo de 12 meses (SIPS)", after: 10 },
  { label: "Calculando el coste con cada tarifa", after: 20 },
];

/**
 * Lo que va haciendo el análisis. El servidor no informa del avance: las
 * fases siguen los tiempos habituales para que la espera no parezca colgada.
 */
function Analyzing() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const current = PHASES.findLastIndex(({ after }) => seconds >= after);

  return (
    <div className="mx-auto max-w-md rounded-2xl border bg-white p-6 shadow-sm" role="status" aria-live="polite">
      <p className="text-sm font-semibold text-gray-900">Analizando la factura</p>
      <p className="mt-1 text-xs text-muted-foreground">Suele tardar entre 15 y 40 segundos. No cierres el panel.</p>
      <ol className="mt-5 space-y-3">
        {PHASES.map(({ label }, index) => (
          <li key={label} className="flex items-center gap-3 text-sm">
            {index < current ? (
              <span className="flex size-5 items-center justify-center rounded-full bg-success-50 text-success-600">
                <Check className="size-3.5" />
              </span>
            ) : index === current ? (
              <Loader2 className="size-5 animate-spin text-primary" />
            ) : (
              <span className="size-5 rounded-full border border-gray-200" />
            )}
            <span className={index <= current ? "text-gray-900" : "text-gray-400"}>{label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });

/** Elegir la factura: un PDF adjunto a la comparativa o uno nuevo. */
export function InvoicePicker({
  pdfs,
  busy,
  onAnalyze,
  onCancel,
}: {
  pdfs: ComparativaStudies["pdfs"];
  busy: boolean;
  onAnalyze: (invoice: { fileId: string } | { file: File }) => void;
  /** Volver al estudio que ya había, sin analizar otra factura. */
  onCancel?: () => void;
}) {
  const [fileId, setFileId] = useState(pdfs[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);

  if (busy) return <Analyzing />;

  const pickFile = (picked: File | undefined | null) => {
    if (picked && (picked.type === "application/pdf" || picked.name.toLowerCase().endsWith(".pdf"))) setFile(picked);
  };

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div>
        <h3 className="text-base font-semibold text-gray-900">¿Qué factura analizamos?</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Con la última factura de luz del cliente calculamos lo que paga hoy y lo que pagaría con cada tarifa.
        </p>
      </div>

      {pdfs.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            Documentos de la comparativa
          </legend>
          {pdfs.map((pdf) => {
            const selected = !file && fileId === pdf.id;
            return (
              <label
                key={pdf.id}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border bg-white p-3 text-sm transition-colors ${
                  selected ? "border-primary ring-1 ring-primary" : "hover:border-gray-300"
                }`}
              >
                <input
                  type="radio"
                  name="invoice"
                  className="sr-only"
                  checked={selected}
                  onChange={() => {
                    setFile(null);
                    setFileId(pdf.id);
                  }}
                />
                <span className={`rounded-lg p-2 ${selected ? "bg-primary-50 text-primary" : "bg-gray-100 text-gray-500"}`}>
                  <FileText className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-gray-900">{pdf.filename}</span>
                  <span className="text-xs text-muted-foreground">Subido el {shortDate(pdf.uploadDate)}</span>
                </span>
                {selected && <Check className="size-4 text-primary" />}
              </label>
            );
          })}
        </fieldset>
      )}

      {file ? (
        <div className="flex items-center gap-3 rounded-xl border border-primary bg-white p-3 text-sm ring-1 ring-primary">
          <span className="rounded-lg bg-primary-50 p-2 text-primary">
            <FileText className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium text-gray-900">{file.name}</span>
            <span className="text-xs text-muted-foreground">Factura nueva · se guarda en la comparativa</span>
          </span>
          <Button variant="ghost" size="icon" className="size-7" onClick={() => setFile(null)} aria-label="Quitar el PDF">
            <X className="size-4" />
          </Button>
        </div>
      ) : (
        <label
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            pickFile(event.dataTransfer.files?.[0]);
          }}
          className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
            dragging ? "border-primary bg-primary-50" : "border-gray-200 bg-white hover:border-gray-300"
          }`}
        >
          <Upload className="size-5 text-gray-400" />
          <span className="text-sm font-medium text-gray-900">
            {pdfs.length > 0 ? "O sube otra factura" : "Sube la factura del cliente"}
          </span>
          <span className="text-xs text-muted-foreground">Arrastra el PDF aquí o haz clic para elegirlo</span>
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            aria-label="Factura en PDF"
            onChange={(event) => pickFile(event.target.files?.[0])}
          />
        </label>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
          Los datos personales se tapan antes de analizarla.
        </p>
        <div className="flex gap-2">
          {onCancel && (
            <Button variant="ghost" onClick={onCancel}>
              Volver al estudio
            </Button>
          )}
          <Button disabled={!file && !fileId} onClick={() => onAnalyze(file ? { file } : { fileId })}>
            Analizar factura
          </Button>
        </div>
      </div>
    </div>
  );
}
