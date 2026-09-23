"use client";

import { useCallback, useState } from "react";
import { FileUp, RotateCcw } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/core/components/ui/dialog";
import TooltipComponent from "@/core/components/TooltipComponent";
import { useExcelImport } from "@/tramites/hooks/useExcelImport";
import { useTramites } from "@/core/contexts/TramitesContext";
import FileUploadStep from "./import-steps/FileUploadStep";
import ValidationStep from "./import-steps/ValidationStep";
import SelectionStep from "./import-steps/SelectionStep";
import NotesStep from "./import-steps/NotesStep";
import SummaryStep from "./import-steps/SummaryStep";

const STEP_TITLES: Record<string, string> = {
  upload: "Importar archivo Excel",
  validation: "Validación de CUPS",
  notes: "Notas",
  selection: "Selección y actualización",
  summary: "Resumen",
};

const STEP_DESCRIPTIONS: Record<string, string> = {
  upload:
    "Importa un Excel de trámites para actualizar la liquidez y añadir notas nuevas.",
  validation: "Se ha cruzado la información del Excel con los datos del CRM.",
  notes: "Revisa las notas nuevas y elige quién puede ver cada una.",
  selection: "Filtra, selecciona y aplica los cambios por tandas.",
  summary: "Detalle de las actualizaciones realizadas.",
};

export function ImportExcelLiquidezModal({
  allowInternalNotes,
}: {
  allowInternalNotes: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const {
    step,
    setStep,
    reset,
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
    summary,
  } = useExcelImport();

  const { refreshTramites } = useTramites();
  const steps = hasNotesStep
    ? ["upload", "validation", "notes", "selection", "summary"]
    : ["upload", "validation", "selection", "summary"];
  const stepNumber = steps.indexOf(step) + 1;
  const totalSteps = steps.length;

  const handleOpen = useCallback(() => {
    if (!hasSavedProgress) {
      reset();
    }
    setIsOpen(true);
  }, [reset, hasSavedProgress]);

  const handleRestore = useCallback(() => {
    restoreSavedProgress();
  }, [restoreSavedProgress]);

  const handleStartFresh = useCallback(() => {
    discardSavedProgress();
    reset();
  }, [discardSavedProgress, reset]);

  const handleClose = useCallback(async () => {
    const hadUpdates = batchTransitions.length > 0 || notesAdded > 0;
    setIsOpen(false);
    reset();
    if (hadUpdates) {
      try {
        await refreshTramites();
      } catch (e) {
        console.error("Error al refrescar trámites:", e);
      }
    }
  }, [reset, refreshTramites, batchTransitions.length, notesAdded]);

  const handleModalOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        handleClose();
      }
    },
    [handleClose],
  );

  return (
    <>
      <TooltipComponent content="Importar Excel de liquidez y notas">
        <Button
          onClick={handleOpen}
          variant="outline"
          size="icon"
          className="h-10 w-10 bg-gray-50 border-gray-200"
        >
          <FileUp className="h-4 w-4" />
        </Button>
      </TooltipComponent>

      <Dialog open={isOpen} onOpenChange={handleModalOpenChange}>
        <DialogContent className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              {/* Step indicator */}
              <div className="flex items-center gap-1.5">
                {Array.from(
                  { length: totalSteps },
                  (_, index) => index + 1,
                ).map((n) => (
                  <div
                    key={n}
                    className={`h-1.5 rounded-full transition-all ${
                      n <= stepNumber ? "w-8 bg-primary" : "w-4 bg-gray-200"
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs text-gray-400">
                Paso {stepNumber} de {totalSteps}
              </span>
            </div>
            <DialogTitle className="text-lg font-semibold text-gray-900">
              {STEP_TITLES[step]}
            </DialogTitle>
            <DialogDescription className="text-gray-500 text-sm">
              {STEP_DESCRIPTIONS[step]}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2">
            {/* Resume prompt (Improvement 6) */}
            {hasSavedProgress && step === "upload" && (
              <div className="flex flex-col gap-3 p-4 rounded-lg bg-amber-50 border border-amber-200 mb-4">
                <div className="flex items-center gap-2 text-sm text-amber-800">
                  <RotateCcw className="h-4 w-4" />
                  <span className="font-medium">
                    Tienes un progreso guardado
                  </span>
                </div>
                <p className="text-xs text-amber-700">
                  Se encontró una sesión anterior con datos de CUPS ya
                  validados. Puedes retomar donde lo dejaste o empezar desde
                  cero.
                </p>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={handleRestore}>
                    Continuar donde lo dejé
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleStartFresh}
                  >
                    Empezar de nuevo
                  </Button>
                </div>
              </div>
            )}

            {step === "upload" && (
              <FileUploadStep
                fileName={fileName}
                parseResult={parseResult}
                parseError={parseError}
                onFileDrop={handleFileDrop}
                onChangeSheet={changeSheet}
                onChangeColumn={changeColumn}
                onChangeCommissionColumn={changeCommissionColumn}
                onNext={() => setStep("validation")}
              />
            )}

            {step === "validation" && (
              <ValidationStep
                isMatching={isMatching}
                error={parseError}
                matchedCups={matchedCups}
                unmatchedCups={unmatchedCups}
                duplicatesInExcel={duplicatesInExcel}
                totalInExcel={parseResult?.cups.length ?? 0}
                commissionMismatches={commissionMismatches}
                isCorrectingCommission={isCorrectingCommission}
                onCorrectCommission={correctCommission}
                onCorrectAllCommissions={correctAllCommissions}
                onRunMatching={runMatching}
                onNext={() => setStep(hasNotesStep ? "notes" : "selection")}
                onBack={() => setStep("upload")}
              />
            )}

            {step === "notes" && (
              <NotesStep
                matchedCups={matchedCups}
                newNotesByTramite={newNotesByTramite}
                allowInternalNotes={allowInternalNotes}
                onSetNoteVisibility={setNoteVisibility}
                onSetAllNotesVisibility={setAllNotesVisibility}
                onNext={() => setStep("selection")}
                onBack={() => setStep("validation")}
              />
            )}

            {step === "selection" && (
              <SelectionStep
                matchedCups={matchedCups}
                newNotesByTramite={newNotesByTramite}
                selectedIds={selectedIds}
                targetStatus={targetStatus}
                isUpdating={isUpdating}
                updateError={updateError}
                batchTransitions={batchTransitions}
                notesAdded={notesAdded}
                conflictWarnings={conflictWarnings}
                updateProgress={updateProgress}
                onToggleSelection={toggleSelection}
                onSelectAllFiltered={selectAllFiltered}
                onDeselectAll={deselectAll}
                onSetTargetStatus={setTargetStatus}
                onUpdateBatch={updateBatch}
                onNext={() => setStep("summary")}
                onBack={() => setStep(hasNotesStep ? "notes" : "validation")}
              />
            )}

            {step === "summary" && summary && (
              <SummaryStep
                summary={summary}
                matchedCups={matchedCups}
                onClose={handleClose}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
