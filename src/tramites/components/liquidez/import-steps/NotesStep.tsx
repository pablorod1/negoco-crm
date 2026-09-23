"use client";

import { Button } from "@/core/components/ui/button";
import type { ExcelImportNote, MatchedCUPS } from "@/tramites/types";
import ImportNotesReview from "./ImportNotesReview";

interface NotesStepProps {
  matchedCups: MatchedCUPS[];
  newNotesByTramite: Record<string, ExcelImportNote[]>;
  allowInternalNotes: boolean;
  onSetNoteVisibility: (
    tramiteId: string,
    noteIndex: number,
    isInternal: boolean,
  ) => void;
  onSetAllNotesVisibility: (isInternal: boolean) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function NotesStep({
  matchedCups,
  newNotesByTramite,
  allowInternalNotes,
  onSetNoteVisibility,
  onSetAllNotesVisibility,
  onNext,
  onBack,
}: NotesStepProps) {
  const seen = new Set<string>();
  const selectedNotes = matchedCups.flatMap((tramite) => {
    if (seen.has(tramite.tramiteId)) return [];
    seen.add(tramite.tramiteId);
    const notes = newNotesByTramite[tramite.tramiteId] ?? [];
    return notes.length > 0 ? [{ tramite, notes }] : [];
  });
  const count = selectedNotes.reduce(
    (total, item) => total + item.notes.length,
    0,
  );
  const unclassified = selectedNotes.reduce(
    (total, item) =>
      total + item.notes.filter((note) => note.isInternal === null).length,
    0,
  );

  return (
    <div className="flex flex-col gap-5">
      {count > 0 ? (
        <ImportNotesReview
          selectedNotes={selectedNotes}
          count={count}
          allowInternalNotes={allowInternalNotes}
          onSetNoteVisibility={onSetNoteVisibility}
          onSetAllNotesVisibility={onSetAllNotesVisibility}
        />
      ) : (
        <p className="rounded-lg border border-green-100 bg-green-50 p-4 text-sm text-green-700">
          Las notas nuevas ya se han aplicado.
        </p>
      )}
      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack}>
          Anterior
        </Button>
        <div className="flex items-center gap-3">
          {unclassified > 0 && (
            <span className="text-xs text-amber-700">
              {unclassified} nota{unclassified !== 1 ? "s" : ""} sin clasificar
            </span>
          )}
          <Button onClick={onNext} disabled={unclassified > 0}>
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  );
}
