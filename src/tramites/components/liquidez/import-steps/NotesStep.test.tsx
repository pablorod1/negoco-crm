import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { MatchedCUPS } from "@/tramites/types";
import NotesStep from "./NotesStep";

const tramite = {
  tramiteId: "TR-1",
  cups: "ES1234567890123456AB",
  clientName: "Cliente Uno",
} as MatchedCUPS;

describe("paso de clasificación de notas", () => {
  test("exige elegir la visibilidad antes de continuar", () => {
    const onSetNoteVisibility = vi.fn();
    const onNext = vi.fn();
    const baseProps = {
      matchedCups: [tramite],
      allowInternalNotes: true,
      onSetNoteVisibility,
      onSetAllNotesVisibility: vi.fn(),
      onNext,
      onBack: vi.fn(),
    };
    const { rerender } = render(
      <NotesStep
        {...baseProps}
        newNotesByTramite={{
          "TR-1": [{ message: "Liquidación revisada", isInternal: null }],
        }}
      />,
    );

    const next = screen.getByRole("button", { name: "Siguiente" });
    expect(next).toBeDisabled();
    expect(
      screen
        .getByRole("button", { name: "Pública" })
        .getAttribute("aria-pressed"),
    ).toBe("false");
    expect(
      screen
        .getByRole("button", { name: "Interna" })
        .getAttribute("aria-pressed"),
    ).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Interna" }));
    expect(onSetNoteVisibility).toHaveBeenCalledWith("TR-1", 0, true);

    rerender(
      <NotesStep
        {...baseProps}
        newNotesByTramite={{
          "TR-1": [{ message: "Liquidación revisada", isInternal: true }],
        }}
      />,
    );
    expect(next).toBeEnabled();
    fireEvent.click(next);
    expect(onNext).toHaveBeenCalledOnce();
  });
});
