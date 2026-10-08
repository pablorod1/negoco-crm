"use client";

import FilePreview from "@/core/components/FilePreview/FilePreview";
import type { ComparativaStudies } from "./api";

type InvoiceFile = ComparativaStudies["invoices"][number];

/** La factura (PDF o foto) en el visor de documentos del CRM, como «Previsualizar» en la ficha. */
export function InvoicePreview({ file, onClose }: { file: InvoiceFile | null; onClose: () => void }) {
  if (!file) return null;
  return (
    <FilePreview
      isOpen
      onClose={onClose}
      file={{
        id: file.id,
        filename: file.filename,
        extension: `.${file.extension}`,
        size: 0,
        download_url: file.downloadUrl,
        upload_date: file.uploadDate,
      }}
    />
  );
}
