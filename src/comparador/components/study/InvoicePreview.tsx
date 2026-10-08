"use client";

import FilePreview from "@/core/components/FilePreview/FilePreview";
import type { ComparativaStudies } from "./api";

type Pdf = ComparativaStudies["pdfs"][number];

/** La factura en el visor de documentos del CRM, como «Previsualizar» en la ficha. */
export function InvoicePreview({ pdf, onClose }: { pdf: Pdf | null; onClose: () => void }) {
  if (!pdf) return null;
  return (
    <FilePreview
      isOpen
      onClose={onClose}
      file={{
        id: pdf.id,
        filename: pdf.filename,
        extension: ".pdf",
        size: 0,
        download_url: pdf.downloadUrl,
        upload_date: pdf.uploadDate,
      }}
    />
  );
}
