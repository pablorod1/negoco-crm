"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, Eye, FileText, Image as ImageIcon, Loader2, ScanText, ShieldCheck, Upload, X } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { isValidCups } from "@/comparador/extraction/identifiers";
import { cn } from "@/core/utils";
import type { ComparativaStudies } from "./api";
import { InvoicePreview } from "./InvoicePreview";
import { Panel } from "./ui";

const PHASES = [
  { label: "Leyendo la factura", after: 0 },
  { label: "Tapando los datos personales", after: 4 },
  { label: "Consultando 12 meses de consumo en el SIPS", after: 10 },
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
    <Panel className="mx-auto max-w-lg overflow-hidden p-8" >
      <div role="status" aria-live="polite">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
          <ScanText className="size-6" />
        </div>
        <h2 className="mt-5 text-lg font-semibold text-gray-900">Analizando la factura</h2>
        <p className="mt-1 text-sm text-gray-500">Suele tardar entre 15 y 40 segundos. Puedes quedarte en esta página.</p>
        <div className="mt-6 h-1 overflow-hidden rounded-full bg-gray-100">
          <motion.div
            className="h-1 rounded-full bg-primary-500"
            initial={{ width: "4%" }}
            animate={{ width: "92%" }}
            transition={{ duration: 35, ease: "easeOut" }}
          />
        </div>
        <ol className="mt-6 space-y-3.5">
          {PHASES.map(({ label }, index) => (
            <li key={label} className="flex items-center gap-3 text-sm">
              {index < current ? (
                <span className="flex size-5 items-center justify-center rounded-full bg-success-500 text-white">
                  <Check className="size-3" strokeWidth={3} />
                </span>
              ) : index === current ? (
                <Loader2 className="size-5 animate-spin text-primary-600" />
              ) : (
                <span className="size-5 rounded-full ring-1 ring-inset ring-gray-200" />
              )}
              <span className={index <= current ? "text-gray-900" : "text-gray-400"}>{label}</span>
            </li>
          ))}
        </ol>
      </div>
    </Panel>
  );
}

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });

/** PDF o foto: lo que lee el estudio (las fotos y los escaneos, con OCR en el CRM). */
const MAX_PHOTOS = 6;
const isPdfFile = (file: File) => file.type === "application/pdf" || /\.pdf$/i.test(file.name);
const isInvoiceFile = (file: File) =>
  file.type === "application/pdf" || file.type.startsWith("image/") || /\.(pdf|jpe?g|png|webp|heic|heif|tiff?)$/i.test(file.name);

/** Elegir la factura: un PDF adjunto a la comparativa o uno nuevo. */
export function InvoicePicker({
  invoices,
  busy,
  cupsPrompt,
  onAnalyze,
  onCancel,
}: {
  invoices: ComparativaStudies["invoices"];
  busy: boolean;
  /** La factura no trae un CUPS legible: el motivo, y se pide aquí mismo. */
  cupsPrompt?: string | null;
  onAnalyze: (invoice: { fileId: string } | { files: File[] }, cups?: string) => void;
  /** Volver al estudio que ya había, sin analizar otra factura. */
  onCancel?: () => void;
}) {
  const [fileId, setFileId] = useState(invoices[0]?.id ?? "");
  const [files, setFiles] = useState<File[]>([]);
  const [rejected, setRejected] = useState<string | null>(null);
  const file = files[0] ?? null;
  const photos = files.length > 0 && !isPdfFile(files[0]);
  const [dragging, setDragging] = useState(false);
  const [previewing, setPreviewing] = useState<ComparativaStudies["invoices"][number] | null>(null);
  const [cups, setCups] = useState("");
  const cupsValid = isValidCups(cups);

  if (busy) return <Analyzing />;

  /** Un PDF, o hasta seis fotos (una por página): las fotos se van sumando. */
  const pickFiles = (list: FileList | null | undefined) => {
    const picked = Array.from(list ?? []);
    if (picked.length === 0) return;
    const unreadable = picked.find((item) => !isInvoiceFile(item));
    if (unreadable) return setRejected(`«${unreadable.name}» no es una factura que se pueda leer. Sube el PDF de la comercializadora o fotos (JPG o PNG).`);
    const pdfs = picked.filter(isPdfFile);
    if (pdfs.length > 0 && picked.length > 1) return setRejected("Sube un solo PDF, o varias fotos de la misma factura (una por página).");
    setRejected(null);
    if (pdfs.length === 1) return setFiles(pdfs);
    setFiles((current) => [...(current.length > 0 && !isPdfFile(current[0]) ? current : []), ...picked].slice(0, MAX_PHOTOS));
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900">¿Qué factura analizamos?</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
          Con la última factura de luz calculamos lo que paga hoy y lo que pagaría con cada tarifa. El CUPS trae del SIPS 12 meses de consumo y la potencia.
        </p>
      </div>

      <InvoicePreview file={previewing} onClose={() => setPreviewing(null)} />
      <Panel className="mt-8 p-5 sm:p-6">
        {invoices.length > 0 && (
          <fieldset>
            <legend className="mb-3 text-[11px] font-medium uppercase tracking-[0.08em] text-gray-500">En la comparativa</legend>
            <div className="space-y-2">
              {invoices.map((pdf) => {
                const selected = files.length === 0 && fileId === pdf.id;
                return (
                  <label
                    key={pdf.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-xl p-3 text-sm ring-1 transition-all",
                      selected ? "bg-primary-50/50 ring-2 ring-primary-500" : "ring-gray-200 hover:ring-gray-300",
                    )}
                  >
                    <input
                      type="radio"
                      name="invoice"
                      className="sr-only"
                      checked={selected}
                      onChange={() => {
                        setFiles([]);
                        setFileId(pdf.id);
                      }}
                    />
                    <span className={cn("rounded-lg p-2", selected ? "bg-primary-100 text-primary-700" : "bg-gray-100 text-gray-500")}>
                      <FileText className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-gray-900">{pdf.filename}</span>
                      <span className="text-xs text-gray-500">Subida el {shortDate(pdf.uploadDate)}</span>
                    </span>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        setPreviewing(pdf);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                    >
                      <Eye className="size-3.5" />
                      Ver
                    </button>
                    <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full", selected ? "bg-primary-600 text-white" : "ring-1 ring-gray-300")}>
                      {selected && <Check className="size-3" strokeWidth={3} />}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}

        <div className={invoices.length > 0 ? "mt-5" : undefined}>
          {files.length > 0 && (
            <ul className="space-y-2">
              {files.map((item, index) => (
                <li key={`${item.name}-${index}`} className="flex items-center gap-3 rounded-xl bg-primary-50/50 p-3 text-sm ring-2 ring-primary-500">
                  <span className="rounded-lg bg-primary-100 p-2 text-primary-700">
                    {photos ? <ImageIcon className="size-4" /> : <FileText className="size-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-gray-900">{item.name}</span>
                    <span className="text-xs text-gray-500">
                      {photos ? `Página ${index + 1} · foto, se lee con OCR en el CRM` : "PDF"} · al analizarla pasa a los documentos
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => setFiles((current) => current.filter((_, position) => position !== index))}
                    aria-label={`Quitar ${item.name}`}
                  >
                    <X className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {(files.length === 0 || (photos && files.length < MAX_PHOTOS)) && (
            <label
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                pickFiles(event.dataTransfer.files);
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed text-center transition-colors",
                photos ? "mt-2 px-4 py-3" : "px-6 py-8",
                dragging ? "border-primary-400 bg-primary-50" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50/50",
              )}
            >
              {photos ? (
                <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Upload className="size-4 text-gray-400" />
                  Añadir otra página
                  <span className="font-normal text-gray-400">(si la factura tiene varias)</span>
                </span>
              ) : (
                <>
                  <span className="flex size-10 items-center justify-center rounded-xl bg-gray-100 text-gray-500">
                    <Upload className="size-5" />
                  </span>
                  <span className="mt-1 text-sm font-medium text-gray-900">{invoices.length > 0 ? "O sube otra factura" : "Sube la factura del cliente"}</span>
                  <span className="text-xs text-gray-500">El PDF, o fotos de cada página. Arrástralos aquí o haz clic para elegirlos</span>
                </>
              )}
              <input
                type="file"
                multiple
                accept="application/pdf,.pdf,image/*"
                className="sr-only"
                aria-label="Factura en PDF o foto"
                onChange={(event) => {
                  pickFiles(event.target.files);
                  event.target.value = "";
                }}
              />
            </label>
          )}
          {rejected && (
            <div role="alert" className="mt-3 flex gap-2.5 rounded-xl bg-warning-50 p-3 text-xs text-gray-800 ring-1 ring-warning-200">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-600" />
              <p>
                {rejected}
              </p>
            </div>
          )}
        </div>

        {cupsPrompt && (
          <div role="alert" className="mt-5 rounded-xl bg-warning-50 p-4 ring-1 ring-warning-200">
            <p className="flex gap-2.5 text-sm text-gray-800">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-600" />
              {cupsPrompt}
            </p>
            <div className="mt-3 space-y-1 pl-6">
              <Label htmlFor="study-cups" className="text-xs">
                CUPS
              </Label>
              <Input
                id="study-cups"
                autoFocus
                autoComplete="off"
                spellCheck={false}
                className="h-9 bg-white font-mono uppercase"
                placeholder="ES 0021 0000 0000 0000 XX"
                value={cups}
                onChange={(event) => setCups(event.target.value)}
              />
              {cups.trim() && (
                <p className={cn("text-xs", cupsValid ? "text-success-700" : "text-gray-500")}>
                  {cupsValid ? "CUPS válido." : "ES, 16 números y las dos letras de control (los espacios no importan)."}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-xs text-gray-500">
            <ShieldCheck className="size-4 shrink-0 text-success-600" />
            Los datos personales se leen en el CRM y se tapan antes de analizarla.
          </p>
          <div className="flex gap-2">
            {onCancel && (
              <Button variant="ghost" onClick={onCancel}>
                Volver al estudio
              </Button>
            )}
            <Button
              className="rounded-xl"
              size="lg"
              disabled={(!file && !fileId) || (Boolean(cups.trim()) && !cupsValid)}
              onClick={() => onAnalyze(files.length > 0 ? { files } : { fileId }, cupsValid ? cups : undefined)}
            >
              Analizar factura
            </Button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
