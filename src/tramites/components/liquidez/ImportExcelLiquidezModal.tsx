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
import SummaryStep from "./import-steps/SummaryStep";

const STEP_TITLES: Record<string, string> = {
  upload: "Importar archivo Excel",
  validation: "Validación de CUPS",
  selection: "Selección y actualización",
  summary: "Resumen",
};

const STEP_DESCRIPTIONS: Record<string, string> = {
  upload:
    "Importa el archivo de certificación de la compañía para actualizar el estado de liquidez.",
  validation: "Se ha cruzado la información del Excel con los datos del CRM.",
  selection: "Filtra, selecciona y actualiza los trámites por tandas.",
  summary: "Detalle de las actualizaciones realizadas.",
};

const STEP_NUMBER: Record<string, number> = {
  upload: 1,
  validation: 2,
  selection: 3,
  summary: 4,
};

export function ImportExcelLiquidezModal() {
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
    summary,
  } = useExcelImport();

  const { refreshTramites } = useTramites();

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
    const hadUpdates = batchTransitions.length > 0;
    setIsOpen(false);
    reset();
    if (hadUpdates) {
      try {
        await refreshTramites();
      } catch (e) {
        console.error("Error al refrescar trámites:", e);
      }
    }
  }, [reset, refreshTramites, batchTransitions.length]);

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
      <TooltipComponent content="Importar Excel de certificación">
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
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    className={`h-1.5 rounded-full transition-all ${
                      n <= STEP_NUMBER[step]
                        ? "w-8 bg-primary"
                        : "w-4 bg-gray-200"
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs text-gray-400">
                Paso {STEP_NUMBER[step]} de 4
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
                onNext={() => setStep("validation")}
              />
            )}

            {step === "validation" && (
              <ValidationStep
                isMatching={isMatching}
                matchedCups={matchedCups}
                unmatchedCups={unmatchedCups}
                duplicatesInExcel={duplicatesInExcel}
                totalInExcel={parseResult?.cups.length ?? 0}
                onRunMatching={runMatching}
                onNext={() => setStep("selection")}
                onBack={() => setStep("upload")}
              />
            )}

            {step === "selection" && (
              <SelectionStep
                matchedCups={matchedCups}
                selectedIds={selectedIds}
                targetStatus={targetStatus}
                isUpdating={isUpdating}
                batchTransitions={batchTransitions}
                conflictWarnings={conflictWarnings}
                updateProgress={updateProgress}
                onToggleSelection={toggleSelection}
                onSelectAllFiltered={selectAllFiltered}
                onDeselectAll={deselectAll}
                onSetTargetStatus={setTargetStatus}
                onUpdateBatch={updateBatch}
                onNext={() => setStep("summary")}
                onBack={() => setStep("validation")}
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
