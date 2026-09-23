"use client";

import { useState } from "react";
import { Button } from "@/core/components/ui/button";
import type { ExcelImportNote, MatchedCUPS } from "@/tramites/types";

const PAGE_SIZE = 25;

export interface SelectedTramiteNotes {
  tramite: MatchedCUPS;
  notes: ExcelImportNote[];
}

interface ImportNotesReviewProps {
  selectedNotes: SelectedTramiteNotes[];
  count: number;
  allowInternalNotes: boolean;
  onSetNoteVisibility: (
    tramiteId: string,
    noteIndex: number,
    isInternal: boolean,
  ) => void;
  onSetAllNotesVisibility?: (isInternal: boolean) => void;
}

export default function ImportNotesReview({
  selectedNotes,
  count,
  allowInternalNotes,
  onSetNoteVisibility,
  onSetAllNotesVisibility,
}: ImportNotesReviewProps) {
  const [currentPage, setCurrentPage] = useState(0);
  if (count === 0) return null;

  const pageCount = Math.ceil(selectedNotes.length / PAGE_SIZE);
  const page = Math.min(currentPage, pageCount - 1);
  const visibleNotes = selectedNotes.slice(
    page * PAGE_SIZE,
    (page + 1) * PAGE_SIZE,
  );

  return (
    <section
      className="rounded-lg border border-gray-200 bg-gray-50/50 p-4"
      aria-label="Notas nuevas del Excel"
    >
      <div className="mb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-900">
            Notas nuevas · {count}
          </h3>
          {onSetAllNotesVisibility && (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onSetAllNotesVisibility(false)}
              >
                Todas públicas
              </Button>
              {allowInternalNotes && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onSetAllNotesVisibility(true)}
                >
                  Todas internas
                </Button>
              )}
            </div>
          )}
        </div>
        <p className="text-xs text-gray-500">
          Elige quién puede ver cada nota. Las públicas son visibles para el
          comercial; las internas, solo para gestión. Solo se añadirán las notas
          de los trámites que actualices.
        </p>
      </div>
      <div className="max-h-60 space-y-3 overflow-y-auto pr-1">
        {visibleNotes.map(({ tramite, notes }) => (
          <div
            key={tramite.tramiteId}
            className="rounded-md border border-gray-200 bg-white p-3"
          >
            <p className="mb-2 text-xs font-medium text-gray-700">
              {tramite.clientName || tramite.cups} · {tramite.cups}
            </p>
            <div className="space-y-2">
              {notes.map((note, index) => (
                <div
                  key={`${tramite.tramiteId}-${index}`}
                  className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-2 first:border-0 first:pt-0"
                >
                  <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm text-gray-800">
                    {note.message}
                  </p>
                  <div
                    className="inline-flex shrink-0 rounded-md border border-gray-200 p-0.5"
                    role="group"
                    aria-label={`Visibilidad de la nota ${index + 1} de ${tramite.cups}`}
                  >
                    <button
                      type="button"
                      aria-pressed={note.isInternal === false}
                      onClick={() =>
                        onSetNoteVisibility(tramite.tramiteId, index, false)
                      }
                      className={`rounded px-2 py-1 text-xs font-medium ${note.isInternal === false ? "bg-primary text-white" : "text-gray-600 hover:bg-gray-100"}`}
                    >
                      Pública
                    </button>
                    {allowInternalNotes && (
                      <button
                        type="button"
                        aria-pressed={note.isInternal === true}
                        onClick={() =>
                          onSetNoteVisibility(tramite.tramiteId, index, true)
                        }
                        className={`rounded px-2 py-1 text-xs font-medium ${note.isInternal === true ? "bg-primary text-white" : "text-gray-600 hover:bg-gray-100"}`}
                      >
                        Interna
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {pageCount > 1 && (
        <div className="mt-3 flex items-center justify-between gap-2 text-xs text-gray-500">
          <span>
            Trámites con notas {page * PAGE_SIZE + 1}–
            {Math.min((page + 1) * PAGE_SIZE, selectedNotes.length)} de{" "}
            {selectedNotes.length}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setCurrentPage(page - 1)}
            >
              Página anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page === pageCount - 1}
              onClick={() => setCurrentPage(page + 1)}
            >
              Página siguiente
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
