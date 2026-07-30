import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { PredefinedNote } from "./PredefinedNote";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PredefinedNote", () => {
  test("shows the full note in a popover when the preview exceeds six lines", () => {
    let resizeCallback: ResizeObserverCallback = () => {};

    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: ResizeObserverCallback) {
          resizeCallback = callback;
        }

        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", () => {});

    const note = {
      id: "note-1",
      user_id: "user-1",
      target: "tramites" as const,
      note: "Una nota predefinida muy larga",
      created_at: null,
      updated_at: null,
    };
    render(<PredefinedNote note={note} />);

    const preview = screen.getByText(note.note);
    Object.defineProperties(preview, {
      clientHeight: { configurable: true, value: 120 },
      scrollHeight: { configurable: true, value: 180 },
    });
    act(() => resizeCallback([], {} as ResizeObserver));

    fireEvent.click(screen.getByRole("button", { name: "Mostrar más" }));

    expect(screen.getByText("Nota predefinida")).toBeInTheDocument();
    expect(screen.getAllByText(note.note)).toHaveLength(2);
  });
});
