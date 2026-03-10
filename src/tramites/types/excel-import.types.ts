import { LiquidezStatus, Status } from "./tramite.types";

/** CUPS extraído del Excel del usuario */
export interface ImportedCUPS {
  cups: string;
  rowIndex: number;
  extraData?: Record<string, string>;
}

/** Resultado del matching de un CUPS contra la base de datos */
export interface MatchedCUPS {
  cups: string;
  tramiteId: string;
  status: Status;
  liquidezStatus: LiquidezStatus;
  clientName: string;
  salesName: string;
  newCompany: string;
  activationDate: string;
  selected: boolean;
}

/** CUPS que no se encontró en la base de datos */
export interface UnmatchedCUPS {
  cups: string;
  rowIndex: number;
  reason: "not_found" | "duplicate_in_excel" | "invalid_format";
}

/** Resultado de la validación de importación */
export interface ImportValidationResult {
  matched: MatchedCUPS[];
  unmatched: UnmatchedCUPS[];
  duplicatesInExcel: string[];
  totalInExcel: number;
}

/** Registro de una transición de estado para el resumen */
export interface StatusTransition {
  fromStatus: LiquidezStatus;
  toStatus: LiquidezStatus;
  count: number;
  cups: string[];
}

/** Resumen final de actualizaciones */
export interface UpdateSummary {
  transitions: StatusTransition[];
  totalUpdated: number;
  totalSkipped: number;
  totalFailed: number;
  skippedCups: string[];
  failedCups: string[];
}

/** Warning de conflicto detectado antes de actualizar */
export interface ConflictWarning {
  type: "status_mismatch" | "already_target" | "no_effect";
  message: string;
  cups: string[];
  severity: "warning" | "info";
}

/** Progreso de actualización por lotes */
export interface UpdateProgress {
  current: number;
  total: number;
  percentage: number;
}

/** Resultado del parseo del Excel */
export interface ExcelParseResult {
  cups: ImportedCUPS[];
  headers: string[];
  detectedColumn: number;
  sheetNames: string[];
  totalRows: number;
  previewRows: string[][];
}

/** Step del wizard */
export type WizardStep = "upload" | "validation" | "selection" | "summary";

/** Respuesta del endpoint match-cups */
export interface MatchCupsResponse {
  success: boolean;
  matched: Omit<MatchedCUPS, "selected">[];
  unmatched: string[];
  error?: string;
}
