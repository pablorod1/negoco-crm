"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { deduplicateCups, isValidCups } from "@/tramites/utils/excel-import";
import { getProcessableCups } from "@/tramites/utils/excel-import-selection";
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
  CommissionMismatch,
  ExcelImportNote,
} from "@/tramites/types";

const SESSION_STORAGE_KEY = "excel-import-wizard-state";

interface PersistedState {
  step: WizardStep;
  fileName: string;
  matchedCups: MatchedCUPS[];
  newNotesByTramite: Record<string, ExcelImportNote[]>;
  hasNotesStep: boolean;
  unmatchedCups: UnmatchedCUPS[];
  duplicatesInExcel: string[];
  selectedIds: string[];
  targetStatus: LiquidezStatus;
  batchTransitions: StatusTransition[];
  notesAdded: number;
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
  changeCommissionColumn: (columnIndex: number | null) => void;

  // Step 2: Validation
  isMatching: boolean;
  matchedCups: MatchedCUPS[];
  newNotesByTramite: Record<string, ExcelImportNote[]>;
  hasNotesStep: boolean;
  unmatchedCups: UnmatchedCUPS[];
  duplicatesInExcel: string[];
  runMatching: () => Promise<void>;
  commissionMismatches: CommissionMismatch[];
  correctCommission: (tramiteId: string) => Promise<void>;
  correctAllCommissions: () => Promise<void>;
  isCorrectingCommission: boolean;

  // Step 3: Selection
  selectedIds: Set<string>;
  toggleSelection: (cups: string) => void;
  selectAllFiltered: (filteredCups: string[]) => void;
  deselectAll: () => void;
  targetStatus: LiquidezStatus;
  setTargetStatus: (status: LiquidezStatus) => void;
  isUpdating: boolean;
  updateError: string | null;
  updateBatch: () => Promise<void>;
  setNoteVisibility: (
    tramiteId: string,
    noteIndex: number,
    isInternal: boolean,
  ) => void;
  setAllNotesVisibility: (isInternal: boolean) => void;
  batchTransitions: StatusTransition[];
  notesAdded: number;

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
  const [newNotesByTramite, setNewNotesByTramite] = useState<
    Record<string, ExcelImportNote[]>
  >({});
  const [hasNotesStep, setHasNotesStep] = useState(false);
  const [unmatchedCups, setUnmatchedCups] = useState<UnmatchedCUPS[]>([]);
  const [duplicatesInExcel, setDuplicatesInExcel] = useState<string[]>([]);
  const [isCorrectingCommission, setIsCorrectingCommission] = useState(false);

  // Step 3 state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [targetStatus, setTargetStatus] = useState<LiquidezStatus>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [batchTransitions, setBatchTransitions] = useState<StatusTransition[]>(
    [],
  );
  const [notesAdded, setNotesAdded] = useState(0);

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
          newNotesByTramite,
          hasNotesStep,
          unmatchedCups,
          duplicatesInExcel,
          selectedIds: Array.from(selectedIds),
          targetStatus,
          batchTransitions,
          notesAdded,
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
    newNotesByTramite,
    hasNotesStep,
    unmatchedCups,
    duplicatesInExcel,
    selectedIds,
    targetStatus,
    batchTransitions,
    notesAdded,
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
      setNewNotesByTramite(parsed.newNotesByTramite ?? {});
      setHasNotesStep(parsed.hasNotesStep ?? false);
      setUnmatchedCups(parsed.unmatchedCups);
      setDuplicatesInExcel(parsed.duplicatesInExcel);
      setSelectedIds(new Set(parsed.selectedIds));
      setTargetStatus(parsed.targetStatus);
      setBatchTransitions(parsed.batchTransitions);
      setNotesAdded(parsed.notesAdded ?? 0);
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
    setNewNotesByTramite({});
    setHasNotesStep(false);
    setUnmatchedCups([]);
    setDuplicatesInExcel([]);
    setSelectedIds(new Set());
    setTargetStatus(null);
    setIsUpdating(false);
    setUpdateError(null);
    setBatchTransitions([]);
    setNotesAdded(0);
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
          commissionColumnIndex: parseResult?.commissionColumn,
        });
        setParseResult(result);
        setParseError(null);
      } catch (err) {
        setParseError(
          err instanceof Error ? err.message : "Error al reprocesar.",
        );
      }
    },
    [fileBuffer, currentSheet, parseResult, parseInWorker],
  );

  const changeCommissionColumn = useCallback(
    async (columnIndex: number | null) => {
      if (!fileBuffer || !parseResult) return;
      try {
        const result = await parseInWorker({
          type: "reparse",
          buffer: fileBuffer,
          sheetIndex: currentSheet,
          columnIndex: parseResult.detectedColumn,
          commissionColumnIndex: columnIndex,
        });
        setParseResult(result);
      } catch (err) {
        setParseError(
          err instanceof Error ? err.message : "Error al reprocesar.",
        );
      }
    },
    [fileBuffer, currentSheet, parseResult, parseInWorker],
  );

  // --- Step 2: Matching ---

  const runMatching = useCallback(async () => {
    if (!parseResult || parseResult.cups.length === 0) return;

    setParseError(null);
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

      const matched: MatchedCUPS[] = data.matched.map((m) => {
        const excelEntry = unique.find((c) => c.cups === m.cups);
        return {
          ...m,
          comisionExcel: excelEntry?.commission ?? null,
          notes: excelEntry?.notes ?? "",
          selected: true,
        };
      });

      const notFoundUnmatched: UnmatchedCUPS[] = data.unmatched.map((cups) => ({
        cups,
        rowIndex: unique.find((c) => c.cups === cups)?.rowIndex ?? 0,
        reason: "not_found" as const,
      }));

      const notesById = new Map<string, string[]>();
      for (const item of matched) {
        if (item.notes && item.notes !== "---") {
          notesById.set(item.tramiteId, [
            ...(notesById.get(item.tramiteId) ?? []),
            item.notes,
          ]);
        }
      }

      const newNotes: Record<string, ExcelImportNote[]> = {};
      if (notesById.size > 0) {
        const entries = [...notesById];
        for (let i = 0; i < entries.length; i += 500) {
          const previewRes = await fetch("/api/v2/contracts/import-liquidez", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mode: "preview",
              updates: entries
                .slice(i, i + 500)
                .map(([id, notes]) => ({ id, notes })),
            }),
          });
          const preview = await previewRes.json();
          if (!previewRes.ok || !preview.success) {
            throw new Error(
              preview.error ?? "Error al revisar las notas del Excel.",
            );
          }
          for (const [id, notes] of Object.entries(
            preview.notesById as Record<string, string[]>,
          )) {
            newNotes[id] = notes.map((message) => ({
              message,
              isInternal: null,
            }));
          }
        }
      }

      setNewNotesByTramite(newNotes);
      setHasNotesStep(
        Object.values(newNotes).some((notes) => notes.length > 0),
      );
      setMatchedCups(matched);
      setUnmatchedCups([...invalidCups, ...dupUnmatched, ...notFoundUnmatched]);
      setSelectedIds(new Set(matched.map((m) => m.cups)));
    } catch (error) {
      setParseError(
        error instanceof Error
          ? error.message
          : "Error de conexión al buscar CUPS.",
      );
    } finally {
      setIsMatching(false);
    }
  }, [parseResult]);

  // --- Commission mismatch detection ---

  const commissionMismatches = useMemo<CommissionMismatch[]>(() => {
    return matchedCups
      .filter(
        (m) =>
          m.comisionExcel != null &&
          Math.abs(m.comisionExcel - m.comision) > 0.001,
      )
      .map((m) => ({
        cups: m.cups,
        tramiteId: m.tramiteId,
        clientName: m.clientName,
        comisionDB: m.comision,
        comisionExcel: m.comisionExcel!,
      }));
  }, [matchedCups]);

  const correctCommission = useCallback(
    async (tramiteId: string) => {
      const mismatch = commissionMismatches.find(
        (m) => m.tramiteId === tramiteId,
      );
      if (!mismatch) return;

      setIsCorrectingCommission(true);
      try {
        const res = await fetch("/api/v2/contracts/update-commission", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            updates: [
              {
                tramiteId: mismatch.tramiteId,
                comision: mismatch.comisionExcel,
              },
            ],
          }),
        });
        const data = await res.json();
        if (data.success) {
          setMatchedCups((prev) =>
            prev.map((m) =>
              m.tramiteId === tramiteId
                ? { ...m, comision: mismatch.comisionExcel }
                : m,
            ),
          );
        }
      } catch (error) {
        console.error("Error al corregir comisión:", error);
      } finally {
        setIsCorrectingCommission(false);
      }
    },
    [commissionMismatches],
  );

  const correctAllCommissions = useCallback(async () => {
    if (commissionMismatches.length === 0) return;

    setIsCorrectingCommission(true);
    try {
      const updates = commissionMismatches.map((m) => ({
        tramiteId: m.tramiteId,
        comision: m.comisionExcel,
      }));

      const res = await fetch("/api/v2/contracts/update-commission", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      const data = await res.json();
      if (data.success) {
        setMatchedCups((prev) =>
          prev.map((m) => {
            const mismatch = commissionMismatches.find(
              (mm) => mm.tramiteId === m.tramiteId,
            );
            return mismatch ? { ...m, comision: mismatch.comisionExcel } : m;
          }),
        );
      }
    } catch (error) {
      console.error("Error al corregir comisiones:", error);
    } finally {
      setIsCorrectingCommission(false);
    }
  }, [commissionMismatches]);

  // --- Step 3: Selection & Batch update ---

  // Conflict detection (Improvement 3)
  const conflictWarnings = useMemo<ConflictWarning[]>(() => {
    if (!targetStatus || selectedIds.size === 0) return [];

    const warnings: ConflictWarning[] = [];
    const selected = matchedCups.filter((m) => selectedIds.has(m.cups));

    // 1. Already in target status
    const alreadyTarget = selected.filter(
      (m) =>
        m.liquidezStatus === targetStatus &&
        (newNotesByTramite[m.tramiteId]?.length ?? 0) === 0,
    );
    if (alreadyTarget.length > 0) {
      warnings.push({
        type: "already_target",
        message: `${alreadyTarget.length} CUPS ya ${alreadyTarget.length === 1 ? "tiene" : "tienen"} el estado "${targetStatus}" y no ${alreadyTarget.length === 1 ? "tiene" : "tienen"} notas nuevas. Se ${alreadyTarget.length === 1 ? "omitirá" : "omitirán"} automáticamente.`,
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
  }, [targetStatus, selectedIds, matchedCups, newNotesByTramite]);

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

  const setNoteVisibility = useCallback(
    (tramiteId: string, noteIndex: number, isInternal: boolean) => {
      setNewNotesByTramite((prev) => ({
        ...prev,
        [tramiteId]: (prev[tramiteId] ?? []).map((note, index) =>
          index === noteIndex ? { ...note, isInternal } : note,
        ),
      }));
    },
    [],
  );

  const setAllNotesVisibility = useCallback((isInternal: boolean) => {
    setNewNotesByTramite((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([id, notes]) => [
          id,
          notes.map((note) => ({ ...note, isInternal })),
        ]),
      ),
    );
  }, []);

  const updateBatch = useCallback(async () => {
    if (selectedIds.size === 0) return;

    setIsUpdating(true);
    setUpdateError(null);
    setUpdateProgress({ current: 0, total: 0, percentage: 0 });
    try {
      const selectedCupsList = getProcessableCups(
        matchedCups,
        selectedIds,
        targetStatus,
        newNotesByTramite,
      );

      if (selectedCupsList.length === 0) {
        return;
      }

      const tramiteIds = [...new Set(selectedCupsList.map((m) => m.tramiteId))];
      const BATCH_SIZE = 50;
      const totalBatches = Math.ceil(tramiteIds.length / BATCH_SIZE);
      const updatedIds = new Set<string>();
      const changedIds = new Set<string>();
      let addedThisBatch = 0;

      setUpdateProgress({
        current: 0,
        total: totalBatches,
        percentage: 0,
      });

      for (let i = 0; i < tramiteIds.length; i += BATCH_SIZE) {
        const batch = tramiteIds.slice(i, i + BATCH_SIZE);
        const batchIndex = Math.floor(i / BATCH_SIZE) + 1;
        const res = await fetch("/api/v2/contracts/import-liquidez", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "apply",
            status: targetStatus,
            updates: batch.map((id) => ({
              id,
              notes: newNotesByTramite[id] ?? [],
            })),
          }),
        });
        const result = await res.json();
        if (!res.ok || !result.success || result.processed !== batch.length) {
          setUpdateError(
            result.error ??
              "No se ha podido completar la actualización. Puedes reintentar con los trámites pendientes.",
          );
          break;
        }
        batch.forEach((id) => updatedIds.add(id));
        for (const id of result.changedIds as string[]) changedIds.add(id);
        addedThisBatch += Number(result.notesAdded ?? 0);

        setUpdateProgress({
          current: batchIndex,
          total: totalBatches,
          percentage: Math.round((batchIndex / totalBatches) * 100),
        });
      }

      if (updatedIds.size === 0) return;

      const updatedCups = selectedCupsList.filter(
        (item) =>
          changedIds.has(item.tramiteId) &&
          targetStatus &&
          item.liquidezStatus !== targetStatus,
      );
      const transitionMap = new Map<string, StatusTransition>();
      for (const item of updatedCups) {
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
      const mergedTransitions = batchTransitions.map((transition) => ({
        ...transition,
        cups: [...transition.cups],
      }));
      for (const transition of newTransitions) {
        const existing = mergedTransitions.find(
          (item) =>
            item.fromStatus === transition.fromStatus &&
            item.toStatus === transition.toStatus,
        );
        if (existing) {
          existing.count += transition.count;
          existing.cups.push(...transition.cups);
        } else {
          mergedTransitions.push({ ...transition });
        }
      }
      if (newTransitions.length > 0) setBatchTransitions(mergedTransitions);
      setNotesAdded((prev) => prev + addedThisBatch);

      if (targetStatus)
        setMatchedCups((prev) =>
          prev.map((m) =>
            updatedIds.has(m.tramiteId) &&
            selectedIds.has(m.cups) &&
            m.liquidezStatus !== targetStatus
              ? { ...m, liquidezStatus: targetStatus }
              : m,
          ),
        );

      setSelectedIds(
        (prev) =>
          new Set(
            [...prev].filter(
              (cups) =>
                !matchedCups.some(
                  (item) =>
                    item.cups === cups && updatedIds.has(item.tramiteId),
                ),
            ),
          ),
      );
      setNewNotesByTramite((prev) =>
        Object.fromEntries(
          Object.entries(prev).filter(([id]) => !updatedIds.has(id)),
        ),
      );

      // If all CUPS have been updated, prepare summary
      const skippedCups = matchedCups
        .filter(
          (m) =>
            selectedIds.has(m.cups) &&
            !updatedIds.has(m.tramiteId) &&
            targetStatus &&
            m.liquidezStatus === targetStatus,
        )
        .map((m) => m.cups);

      setSummary({
        transitions: mergedTransitions,
        totalUpdated: mergedTransitions.reduce(
          (sum, transition) => sum + transition.count,
          0,
        ),
        totalNotesAdded: notesAdded + addedThisBatch,
        totalSkipped: skippedCups.length,
        totalFailed: 0,
        skippedCups,
        failedCups: [],
      });
      if (updatedIds.size === tramiteIds.length)
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (error) {
      console.error("Error al actualizar trámites:", error);
      setUpdateError(
        error instanceof Error
          ? error.message
          : "Error al actualizar trámites.",
      );
    } finally {
      setIsUpdating(false);
      setUpdateProgress(null);
    }
  }, [
    targetStatus,
    selectedIds,
    matchedCups,
    batchTransitions,
    newNotesByTramite,
    notesAdded,
  ]);

  // Computed summary from accumulated transitions
  const currentSummary = useMemo<UpdateSummary | null>(() => {
    if (summary) return summary;
    if (batchTransitions.length === 0 && notesAdded === 0) return null;
    return {
      transitions: batchTransitions,
      totalUpdated: batchTransitions.reduce((s, t) => s + t.count, 0),
      totalNotesAdded: notesAdded,
      totalSkipped: 0,
      totalFailed: 0,
      skippedCups: [],
      failedCups: [],
    };
  }, [summary, batchTransitions, notesAdded]);

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
    changeCommissionColumn,
    isMatching,
    matchedCups,
    newNotesByTramite,
    hasNotesStep,
    unmatchedCups,
    duplicatesInExcel,
    runMatching,
    commissionMismatches,
    correctCommission,
    correctAllCommissions,
    isCorrectingCommission,
    selectedIds,
    toggleSelection,
    selectAllFiltered,
    deselectAll,
    targetStatus,
    setTargetStatus,
    isUpdating,
    updateError,
    updateBatch,
    setNoteVisibility,
    setAllNotesVisibility,
    batchTransitions,
    notesAdded,
    conflictWarnings,
    updateProgress,
    hasSavedProgress,
    restoreSavedProgress,
    discardSavedProgress,
    summary: currentSummary,
  };
}
