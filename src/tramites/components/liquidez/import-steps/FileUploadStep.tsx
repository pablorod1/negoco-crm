"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { FileSpreadsheet, Upload, AlertCircle, Check } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/core/components/ui/select";
import type { ExcelParseResult } from "@/tramites/types";

interface FileUploadStepProps {
  fileName: string;
  parseResult: ExcelParseResult | null;
  parseError: string | null;
  onFileDrop: (file: File) => Promise<void>;
  onChangeSheet: (sheetIndex: number) => void;
  onChangeColumn: (columnIndex: number) => void;
  onNext: () => void;
}

const ACCEPTED_EXTENSIONS = {
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
    ".xlsx",
  ],
  "application/vnd.ms-excel": [".xls"],
  "text/csv": [".csv"],
};

export default function FileUploadStep({
  fileName,
  parseResult,
  parseError,
  onFileDrop,
  onChangeSheet,
  onChangeColumn,
  onNext,
}: FileUploadStepProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onFileDrop(acceptedFiles[0]);
      }
    },
    [onFileDrop],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_EXTENSIONS,
    maxFiles: 1,
    multiple: false,
  });

  const canProceed =
    parseResult &&
    parseResult.detectedColumn !== -1 &&
    parseResult.cups.length > 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Drop zone */}
      <div
        {...getRootProps()}
        aria-label="Zona de carga de archivo Excel"
        className={`
          flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
          ${isDragActive ? "border-primary bg-primary/5" : "border-gray-200 hover:border-primary/50 hover:bg-gray-50"}
          ${parseResult ? "py-5" : "py-10"}
        `}
      >
        <input {...getInputProps()} />
        {parseResult ? (
          <div className="flex items-center gap-3 w-full">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-50">
              <FileSpreadsheet className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {fileName}
              </p>
              <p className="text-xs text-gray-500">
                {parseResult.totalRows} filas · {parseResult.cups.length} CUPS
                detectados
              </p>
            </div>
            <p className="text-xs text-primary font-medium">Cambiar archivo</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-100">
              <Upload className="h-5 w-5 text-gray-500" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700">
                {isDragActive
                  ? "Suelta el archivo aquí"
                  : "Arrastra tu archivo Excel aquí"}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                o haz clic para seleccionar · .xlsx, .xls, .csv
              </p>
            </div>
          </>
        )}
      </div>

      {/* Error message */}
      {parseError && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
          <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-700">{parseError}</p>
        </div>
      )}

      {/* Sheet selector (if multiple sheets) */}
      {parseResult && parseResult.sheetNames.length > 1 && (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">Hoja</label>
          <Select
            onValueChange={(val) => onChangeSheet(Number(val))}
            defaultValue="0"
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {parseResult.sheetNames.map((name, idx) => (
                <SelectItem key={idx} value={String(idx)}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Column selector */}
      {parseResult && parseResult.headers.length > 0 && (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">
            Columna CUPS
          </label>
          <Select
            onValueChange={(val) => onChangeColumn(Number(val))}
            value={
              parseResult.detectedColumn >= 0
                ? String(parseResult.detectedColumn)
                : undefined
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona la columna de CUPS" />
            </SelectTrigger>
            <SelectContent>
              {parseResult.headers.map((header, idx) => (
                <SelectItem key={idx} value={String(idx)}>
                  <span className="flex items-center gap-2">
                    {header || `Columna ${idx + 1}`}
                    {idx === parseResult.detectedColumn && (
                      <Check className="h-3 w-3 text-green-600" />
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Preview table */}
      {parseResult &&
        parseResult.previewRows.length > 0 &&
        parseResult.detectedColumn >= 0 && (
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">
              Vista previa (primeras 5 filas)
            </label>
            <div className="overflow-x-auto border rounded-lg flex-1 w-full max-w-[53rem] ">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    {parseResult.headers.map((h, idx) => (
                      <th
                        key={idx}
                        scope="col"
                        className={`px-3 py-2 text-left font-medium whitespace-nowrap ${
                          idx === parseResult.detectedColumn
                            ? "bg-primary/10 text-primary"
                            : "text-gray-500"
                        }`}
                      >
                        {h || `Col ${idx + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parseResult.previewRows.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      className={rIdx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}
                    >
                      {row.map((cell, cIdx) => (
                        <td
                          key={cIdx}
                          className={`px-3 py-1.5 whitespace-nowrap truncate max-w-20 ${
                            cIdx === parseResult.detectedColumn
                              ? "font-medium text-primary bg-primary/5"
                              : "text-gray-600"
                          }`}
                        >
                          {cell || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      {/* Next button */}
      <div className="flex justify-end pt-2">
        <Button onClick={onNext} disabled={!canProceed}>
          Siguiente
        </Button>
      </div>
    </div>
  );
}
