"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { deduplicateCups, isValidCups } from "@/tramites/utils/excel-import";
import type {
  WorkerRequest,
  WorkerResponse,
} from "@/tramites/workers/excel-parse.worker";
import {
  PLAIN_LIQUIDEZ_STATUS,
  BAJA_LIQUIDEZ_STATUS,
} from "@/tramites/constants";
import type {
  WizardStep,
  ExcelParseResult,
  MatchedCUPS,
  UnmatchedCUPS,
  StatusTransition,
  UpdateSummary,
  LiquidezStatus,
  MatchCupsResponse,
  ConflictWarning,
  UpdateProgress,
} from "@/tramites/types";

const SESSION_STORAGE_KEY = "excel-import-wizard-state";

interface PersistedState {
  step: WizardStep;
  fileName: string;
  matchedCups: MatchedCUPS[];
  unmatchedCups: UnmatchedCUPS[];
  duplicatesInExcel: string[];
  selectedIds: string[];
  targetStatus: LiquidezStatus;
  batchTransitions: StatusTransition[];
  timestamp: number;
}

interface UseExcelImportReturn {
  // Wizard state
  step: WizardStep;
  setStep: (step: WizardStep) => void;
  reset: () => void;

  // Step 1: File upload
  fileBuffer: ArrayBuffer | null;
  fileName: string;
  parseResult: ExcelParseResult | null;
  parseError: string | null;
  handleFileDrop: (file: File) => Promise<void>;
  changeSheet: (sheetIndex: number) => void;
  changeColumn: (columnIndex: number) => void;

  // Step 2: Validation
  isMatching: boolean;
  matchedCups: MatchedCUPS[];
  unmatchedCups: UnmatchedCUPS[];
  duplicatesInExcel: string[];
  runMatching: () => Promise<void>;

  // Step 3: Selection
  selectedIds: Set<string>;
  toggleSelection: (cups: string) => void;
  selectAllFiltered: (filteredCups: string[]) => void;
  deselectAll: () => void;
  targetStatus: LiquidezStatus;
  setTargetStatus: (status: LiquidezStatus) => void;
  isUpdating: boolean;
  updateBatch: () => Promise<void>;
  batchTransitions: StatusTransition[];

  // Conflict warnings
  conflictWarnings: ConflictWarning[];

  // Progress
  updateProgress: UpdateProgress | null;

  // Persistence
  hasSavedProgress: boolean;
  restoreSavedProgress: () => void;
  discardSavedProgress: () => void;

  // Step 4: Summary
  summary: UpdateSummary | null;
}

export function useExcelImport(): UseExcelImportReturn {
  // Wizard navigation
  const [step, setStep] = useState<WizardStep>("upload");

  // Step 1 state
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState("");
  const [parseResult, setParseResult] = useState<ExcelParseResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [currentSheet, setCurrentSheet] = useState(0);

  // Step 2 state
  const [isMatching, setIsMatching] = useState(false);
  const [matchedCups, setMatchedCups] = useState<MatchedCUPS[]>([]);
  const [unmatchedCups, setUnmatchedCups] = useState<UnmatchedCUPS[]>([]);
  const [duplicatesInExcel, setDuplicatesInExcel] = useState<string[]>([]);

  // Step 3 state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [targetStatus, setTargetStatus] = useState<LiquidezStatus>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [batchTransitions, setBatchTransitions] = useState<StatusTransition[]>(
    [],
  );

  // Step 4 state
  const [summary, setSummary] = useState<UpdateSummary | null>(null);

  // Progress state (Improvement 7)
  const [updateProgress, setUpdateProgress] = useState<UpdateProgress | null>(
    null,
  );

  // Persistence state (Improvement 6)
  const [hasSavedProgress, setHasSavedProgress] = useState(false);
  const isRestoringRef = useRef(false);

  // B.2: Web Worker for Excel parsing
  const workerRef = useRef<Worker | null>(null);

  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL("../workers/excel-parse.worker.ts", import.meta.url),
      );
    }
    return workerRef.current;
  }, []);

  const parseInWorker = useCallback(
    (msg: WorkerRequest): Promise<ExcelParseResult> => {
      return new Promise((resolve, reject) => {
        const worker = getWorker();
        worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
          if (e.data.type === "result") resolve(e.data.result);
          else reject(new Error(e.data.error));
        };
        worker.onerror = (e) => reject(new Error(e.message));
        worker.postMessage(msg);
      });
    },
    [getWorker],
  );

  // Cleanup worker on unmount
  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  // Check for saved progress on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (saved) {
        const parsed: PersistedState = JSON.parse(saved);
        // Only show resume if saved less than 2 hours ago and was in selection step
        const twoHours = 2 * 60 * 60 * 1000;
        if (
          Date.now() - parsed.timestamp < twoHours &&
          parsed.step === "selection" &&
          parsed.matchedCups.length > 0
        ) {
          setHasSavedProgress(true);
        } else {
          sessionStorage.removeItem(SESSION_STORAGE_KEY);
        }
      }
    } catch {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, []);

  // B.3: Debounce ref for sessionStorage save
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Save progress to sessionStorage when in selection step (debounced)
  useEffect(() => {
    if (isRestoringRef.current) return;
    if (step === "selection" && matchedCups.length > 0) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        const state: PersistedState = {
          step,
          fileName,
          matchedCups,
          unmatchedCups,
          duplicatesInExcel,
          selectedIds: Array.from(selectedIds),
          targetStatus,
          batchTransitions,
          timestamp: Date.now(),
        };
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(state));
      }, 1000);
    }
    return () => clearTimeout(saveTimeoutRef.current);
  }, [
    step,
    fileName,
    matchedCups,
    unmatchedCups,
    duplicatesInExcel,
    selectedIds,
    targetStatus,
    batchTransitions,
  ]);

  const restoreSavedProgress = useCallback(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!saved) return;
      isRestoringRef.current = true;
      const parsed: PersistedState = JSON.parse(saved);
      setStep(parsed.step);
      setFileName(parsed.fileName);
      setMatchedCups(parsed.matchedCups);
      setUnmatchedCups(parsed.unmatchedCups);
      setDuplicatesInExcel(parsed.duplicatesInExcel);
      setSelectedIds(new Set(parsed.selectedIds));
      setTargetStatus(parsed.targetStatus);
      setBatchTransitions(parsed.batchTransitions);
      setHasSavedProgress(false);
      // Allow saving again after restoring
      requestAnimationFrame(() => {
        isRestoringRef.current = false;
      });
    } catch {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      setHasSavedProgress(false);
    }
  }, []);

  const discardSavedProgress = useCallback(() => {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    setHasSavedProgress(false);
  }, []);

  const reset = useCallback(() => {
    setStep("upload");
    setFileBuffer(null);
    setFileName("");
    setParseResult(null);
    setParseError(null);
    setCurrentSheet(0);
    setIsMatching(false);
    setMatchedCups([]);
    setUnmatchedCups([]);
    setDuplicatesInExcel([]);
    setSelectedIds(new Set());
    setTargetStatus(null);
    setIsUpdating(false);
    setBatchTransitions([]);
    setSummary(null);
    setUpdateProgress(null);
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  }, []);

  // --- Step 1: File handling ---

  const handleFileDrop = useCallback(
    async (file: File) => {
      setParseError(null);

      try {
        const buffer = await file.arrayBuffer();
        setFileBuffer(buffer);
        setFileName(file.name);
        setCurrentSheet(0);

        const result = await parseInWorker({
          type: "parse",
          buffer,
          sheetIndex: 0,
        });
        setParseResult(result);

        if (result.detectedColumn === -1) {
          setParseError(
            "No se ha detectado automáticamente la columna de CUPS. Selecciona la columna manualmente.",
          );
        }
      } catch (err) {
        setParseError(
          err instanceof Error ? err.message : "Error al leer el archivo.",
        );
        setParseResult(null);
      }
    },
    [parseInWorker],
  );

  const changeSheet = useCallback(
    async (sheetIndex: number) => {
      if (!fileBuffer) return;
      setCurrentSheet(sheetIndex);
      try {
        const result = await parseInWorker({
          type: "parse",
          buffer: fileBuffer,
          sheetIndex,
        });
        setParseResult(result);
        setParseError(
          result.detectedColumn === -1
            ? "No se ha detectado automáticamente la columna de CUPS. Selecciona la columna manualmente."
            : null,
        );
      } catch (err) {
        setParseError(
          err instanceof Error ? err.message : "Error al leer la hoja.",
        );
      }
    },
    [fileBuffer, parseInWorker],
  );

  const changeColumn = useCallback(
    async (columnIndex: number) => {
      if (!fileBuffer) return;
      try {
        const result = await parseInWorker({
          type: "reparse",
          buffer: fileBuffer,
          sheetIndex: currentSheet,
          columnIndex,
        });
        setParseResult(result);
        setParseError(null);
      } catch (err) {
        setParseError(
          err instanceof Error ? err.message : "Error al reprocesar.",
        );
      }
    },
    [fileBuffer, currentSheet, parseInWorker],
  );

  // --- Step 2: Matching ---

  const runMatching = useCallback(async () => {
    if (!parseResult || parseResult.cups.length === 0) return;

    setIsMatching(true);
    try {
      // Separate invalid CUPS
      const invalidCups: UnmatchedCUPS[] = [];
      const validCups = parseResult.cups.filter((c) => {
        if (!isValidCups(c.cups)) {
          invalidCups.push({
            cups: c.cups,
            rowIndex: c.rowIndex,
            reason: "invalid_format",
          });
          return false;
        }
        return true;
      });

      // Deduplicate
      const { unique, duplicates } = deduplicateCups(validCups);
      setDuplicatesInExcel(duplicates);

      const dupUnmatched: UnmatchedCUPS[] = duplicates.map((cups) => ({
        cups,
        rowIndex: validCups.find((c) => c.cups === cups)?.rowIndex ?? 0,
        reason: "duplicate_in_excel" as const,
      }));

      // Call API
      const cupsToMatch = unique.map((c) => c.cups);
      const res = await fetch("/api/v2/contracts/match-cups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cups: cupsToMatch }),
      });

      const data: MatchCupsResponse = await res.json();

      if (!data.success) {
        setParseError(data.error ?? "Error al buscar CUPS en el sistema.");
        return;
      }

      const matched: MatchedCUPS[] = data.matched.map((m) => ({
        ...m,
        selected: true,
      }));

      const notFoundUnmatched: UnmatchedCUPS[] = data.unmatched.map((cups) => ({
        cups,
        rowIndex: unique.find((c) => c.cups === cups)?.rowIndex ?? 0,
        reason: "not_found" as const,
      }));

      setMatchedCups(matched);
      setUnmatchedCups([...invalidCups, ...dupUnmatched, ...notFoundUnmatched]);
      setSelectedIds(new Set(matched.map((m) => m.cups)));
    } catch {
      setParseError("Error de conexión al buscar CUPS.");
    } finally {
      setIsMatching(false);
    }
  }, [parseResult]);

  // --- Step 3: Selection & Batch update ---

  // Conflict detection (Improvement 3)
  const conflictWarnings = useMemo<ConflictWarning[]>(() => {
    if (!targetStatus || selectedIds.size === 0) return [];

    const warnings: ConflictWarning[] = [];
    const selected = matchedCups.filter((m) => selectedIds.has(m.cups));

    // 1. Already in target status
    const alreadyTarget = selected.filter(
      (m) => m.liquidezStatus === targetStatus,
    );
    if (alreadyTarget.length > 0) {
      warnings.push({
        type: "already_target",
        message: `${alreadyTarget.length} CUPS ya ${alreadyTarget.length === 1 ? "tiene" : "tienen"} el estado "${targetStatus}". Se omitirán automáticamente.`,
        cups: alreadyTarget.map((m) => m.cups),
        severity: "info",
      });
    }

    // 2. Status mismatch: Activo ↔ Baja status groups
    const isTargetBaja = (BAJA_LIQUIDEZ_STATUS as readonly string[]).includes(
      targetStatus,
    );
    const isTargetPlain = (PLAIN_LIQUIDEZ_STATUS as readonly string[]).includes(
      targetStatus,
    );

    if (isTargetBaja) {
      const activoMismatch = selected.filter((m) => m.status === "Activo");
      if (activoMismatch.length > 0) {
        warnings.push({
          type: "status_mismatch",
          message: `${activoMismatch.length} CUPS ${activoMismatch.length === 1 ? "tiene" : "tienen"} estado "Activo" pero se va a asignar un estado de liquidez de Baja ("${targetStatus}"). Verifica que es correcto.`,
          cups: activoMismatch.map((m) => m.cups),
          severity: "warning",
        });
      }
    }

    if (isTargetPlain) {
      const bajaMismatch = selected.filter((m) => m.status === "Baja");
      if (bajaMismatch.length > 0) {
        warnings.push({
          type: "status_mismatch",
          message: `${bajaMismatch.length} CUPS ${bajaMismatch.length === 1 ? "tiene" : "tienen"} estado "Baja" pero se va a asignar un estado de liquidez activo ("${targetStatus}"). Los trámites en Baja normalmente usan "Pendiente de Descontar" o "Descontado".`,
          cups: bajaMismatch.map((m) => m.cups),
          severity: "warning",
        });
      }
    }

    return warnings;
  }, [targetStatus, selectedIds, matchedCups]);

  const toggleSelection = useCallback((cups: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(cups)) {
        next.delete(cups);
      } else {
        next.add(cups);
      }
      return next;
    });
  }, []);

  const selectAllFiltered = useCallback((filteredCups: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredCups.forEach((c) => next.add(c));
      return next;
    });
  }, []);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const updateBatch = useCallback(async () => {
    if (!targetStatus || selectedIds.size === 0) return;

    setIsUpdating(true);
    setUpdateProgress({ current: 0, total: 0, percentage: 0 });
    try {
      // Get tramite IDs for selected CUPS
      const selectedCupsList = matchedCups.filter(
        (m) => selectedIds.has(m.cups) && m.liquidezStatus !== targetStatus,
      );

      if (selectedCupsList.length === 0) {
        setIsUpdating(false);
        setUpdateProgress(null);
        return;
      }

      // Deduplicate tramite IDs (multiple CUPS can belong to same tramite)
      const tramiteIds = [...new Set(selectedCupsList.map((m) => m.tramiteId))];

      // Send in batches of 50
      const BATCH_SIZE = 50;
      let totalUpdated = 0;
      const totalBatches = Math.ceil(tramiteIds.length / BATCH_SIZE);

      setUpdateProgress({
        current: 0,
        total: totalBatches,
        percentage: 0,
      });

      for (let i = 0; i < tramiteIds.length; i += BATCH_SIZE) {
        const batch = tramiteIds.slice(i, i + BATCH_SIZE);
        const batchIndex = Math.floor(i / BATCH_SIZE) + 1;
        const res = await fetch("/api/v2/contracts/multiple", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: batch, status: targetStatus }),
        });
        const result = await res.json();
        if (result.success) {
          totalUpdated += batch.length;
        }

        setUpdateProgress({
          current: batchIndex,
          total: totalBatches,
          percentage: Math.round((batchIndex / totalBatches) * 100),
        });
      }

      // Record transitions
      const transitionMap = new Map<string, StatusTransition>();
      for (const item of selectedCupsList) {
        const key = `${item.liquidezStatus ?? "null"}→${targetStatus}`;
        const existing = transitionMap.get(key);
        if (existing) {
          existing.count++;
          existing.cups.push(item.cups);
        } else {
          transitionMap.set(key, {
            fromStatus: item.liquidezStatus,
            toStatus: targetStatus,
            count: 1,
            cups: [item.cups],
          });
        }
      }

      const newTransitions = Array.from(transitionMap.values());
      setBatchTransitions((prev) => {
        const merged = [...prev];
        for (const t of newTransitions) {
          const existing = merged.find(
            (m) => m.fromStatus === t.fromStatus && m.toStatus === t.toStatus,
          );
          if (existing) {
            existing.count += t.count;
            existing.cups.push(...t.cups);
          } else {
            merged.push({ ...t });
          }
        }
        return merged;
      });

      // Update matched CUPS state to reflect new status
      setMatchedCups((prev) =>
        prev.map((m) =>
          selectedIds.has(m.cups) && m.liquidezStatus !== targetStatus
            ? { ...m, liquidezStatus: targetStatus }
            : m,
        ),
      );

      // Clear selection after batch
      setSelectedIds(new Set());

      // If all CUPS have been updated, prepare summary
      const skippedCups = matchedCups
        .filter(
          (m) => selectedIds.has(m.cups) && m.liquidezStatus === targetStatus,
        )
        .map((m) => m.cups);

      if (totalUpdated > 0) {
        setSummary({
          transitions: [...batchTransitions, ...newTransitions],
          totalUpdated:
            batchTransitions.reduce((s, t) => s + t.count, 0) +
            selectedCupsList.length,
          totalSkipped: skippedCups.length,
          totalFailed: 0,
          skippedCups,
          failedCups: [],
        });
        // Clear sessionStorage after successful update
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch (error) {
      console.error("Error al actualizar trámites:", error);
    } finally {
      setIsUpdating(false);
      setUpdateProgress(null);
    }
  }, [targetStatus, selectedIds, matchedCups, batchTransitions]);

  // Computed summary from accumulated transitions
  const currentSummary = useMemo<UpdateSummary | null>(() => {
    if (summary) return summary;
    if (batchTransitions.length === 0) return null;
    return {
      transitions: batchTransitions,
      totalUpdated: batchTransitions.reduce((s, t) => s + t.count, 0),
      totalSkipped: 0,
      totalFailed: 0,
      skippedCups: [],
      failedCups: [],
    };
  }, [summary, batchTransitions]);

  return {
    step,
    setStep,
    reset,
    fileBuffer,
    fileName,
    parseResult,
    parseError,
    handleFileDrop,
    changeSheet,
    changeColumn,
    isMatching,
    matchedCups,
    unmatchedCups,
    duplicatesInExcel,
    runMatching,
    selectedIds,
    toggleSelection,
    selectAllFiltered,
    deselectAll,
    targetStatus,
    setTargetStatus,
    isUpdating,
    updateBatch,
    batchTransitions,
    conflictWarnings,
    updateProgress,
    hasSavedProgress,
    restoreSavedProgress,
    discardSavedProgress,
    summary: currentSummary,
  };
}
