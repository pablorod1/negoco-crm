import { AlertTriangle } from "lucide-react";
import type { AbarcaWebhookDocument } from "@/comparativas/types";

const LABELS: Record<AbarcaWebhookDocument["field"], string> = {
  comparativa_pdf: "Estudio",
  dni_photo_front: "DNI (anverso)",
  dni_photo_back: "DNI (reverso)",
  justo_titulo: "Justo título",
};

const ORDER: AbarcaWebhookDocument["field"][] = [
  "comparativa_pdf",
  "dni_photo_front",
  "dni_photo_back",
  "justo_titulo",
];

function describe(document: AbarcaWebhookDocument): string {
  if (document.status === "missing") {
    return "el comparador no lo envió";
  }
  if (document.status === "quarantined") {
    return "llegó en un formato que no reconocemos (no es JPG, PNG ni PDF)";
  }

  const reason = document.reason ?? "";
  if (reason.startsWith("undecodable_base64")) {
    return "llegó corrupto y no se pudo leer";
  }
  if (reason.includes("too_large")) {
    const bytes = Number(reason.split(":")[1]);
    return Number.isFinite(bytes)
      ? `superaba el tamaño máximo (${(bytes / (1024 * 1024)).toFixed(1)} MB)`
      : "superaba el tamaño máximo";
  }
  return "no se pudo procesar";
}

export function AbarcaDocumentsNotice({
  documents,
}: {
  documents: AbarcaWebhookDocument[] | undefined;
}) {
  const incomplete = (documents ?? [])
    .filter((document) => document.status !== "stored")
    .sort((a, b) => ORDER.indexOf(a.field) - ORDER.indexOf(b.field));

  if (incomplete.length === 0) return null;

  return (
    <div
      role="status"
      className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3"
    >
      <p className="flex items-center gap-2 text-sm font-medium text-amber-900">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        Documentos que no llegaron completos desde el comparador
      </p>
      <ul className="mt-2 space-y-1 pl-6 text-sm text-amber-800">
        {incomplete.map((document) => (
          <li key={document.field} className="list-disc">
            <span className="font-medium">{LABELS[document.field]}</span>:{" "}
            {describe(document)}
            {document.download_url && (
              <>
                {" — "}
                <a
                  href={document.download_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2"
                >
                  descargar el original
                </a>
              </>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2 pl-6 text-xs text-amber-700">
        Pide al comercial que los vuelva a subir aquí, o que repita el envío
        desde el comparador.
      </p>
    </div>
  );
}
