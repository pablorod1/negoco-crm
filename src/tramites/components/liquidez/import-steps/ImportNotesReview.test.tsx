import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { MatchedCUPS } from "@/tramites/types";
import ImportNotesReview from "./ImportNotesReview";

const tramite = {
  tramiteId: "TR-1",
  cups: "ES1234567890123456AB",
  clientName: "Cliente Uno",
} as MatchedCUPS;

describe("revisión de notas importadas", () => {
  test("permite elegir la visibilidad de cada nota por separado", () => {
    const onSetNoteVisibility = vi.fn();
    const onSetAllNotesVisibility = vi.fn();
    render(
      <ImportNotesReview
        selectedNotes={[
          {
            tramite,
            notes: [
              { message: "Pago acordado", isInternal: false },
              { message: "Comprobar factura", isInternal: true },
            ],
          },
        ]}
        count={2}
        allowInternalNotes
        onSetNoteVisibility={onSetNoteVisibility}
        onSetAllNotesVisibility={onSetAllNotesVisibility}
      />,
    );

    const first = screen.getByRole("group", { name: /nota 1/i });
    const second = screen.getByRole("group", { name: /nota 2/i });
    expect(
      within(first)
        .getByRole("button", { name: "Pública" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      within(second)
        .getByRole("button", { name: "Interna" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    fireEvent.click(within(first).getByRole("button", { name: "Interna" }));
    expect(onSetNoteVisibility).toHaveBeenCalledWith("TR-1", 0, true);
    fireEvent.click(within(second).getByRole("button", { name: "Pública" }));
    expect(onSetNoteVisibility).toHaveBeenCalledWith("TR-1", 1, false);
    fireEvent.click(screen.getByRole("button", { name: "Todas internas" }));
    expect(onSetAllNotesVisibility).toHaveBeenCalledWith(true);
  });

  test("oculta la opción interna sin permisos", () => {
    render(
      <ImportNotesReview
        selectedNotes={[
          { tramite, notes: [{ message: "Nota nueva", isInternal: false }] },
        ]}
        count={1}
        allowInternalNotes={false}
        onSetNoteVisibility={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Interna" })).toBeNull();
    expect(screen.getByText("Nota nueva")).toBeTruthy();
  });

  test("pagina los trámites con notas para mantener la revisión manejable", () => {
    const selectedNotes = Array.from({ length: 26 }, (_, index) => ({
      tramite: {
        ...tramite,
        tramiteId: `TR-${index + 1}`,
        cups: `CUPS-${index + 1}`,
      },
      notes: [{ message: `Nota ${index + 1}`, isInternal: false }],
    }));
    render(
      <ImportNotesReview
        selectedNotes={selectedNotes}
        count={26}
        allowInternalNotes
        onSetNoteVisibility={vi.fn()}
      />,
    );

    expect(screen.queryByText("Nota 26")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Página siguiente" }));
    expect(screen.getByText("Nota 26")).toBeTruthy();
    expect(screen.queryByText("Nota 1")).toBeNull();
  });
});
