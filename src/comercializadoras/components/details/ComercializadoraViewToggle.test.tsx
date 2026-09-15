import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { ComercializadoraViewToggle } from "./ComercializadoraViewToggle";

describe("ComercializadoraViewToggle", () => {
  test("offers only the tramites and documentos views", () => {
    render(
      <ComercializadoraViewToggle currentView="tramites" onViewChange={vi.fn()} />
    );

    expect(screen.getAllByRole("button").map((b) => b.getAttribute("aria-label")))
      .toEqual(["Trámites", "Documentos"]);
  });

  test("shows the counters as badges and selects the documents view", () => {
    const onViewChange = vi.fn();

    render(
      <ComercializadoraViewToggle
        currentView="tramites"
        onViewChange={onViewChange}
        numTramites={128}
        numFiles={12}
      />
    );

    expect(screen.getByText("128")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Documentos" }));

    expect(onViewChange).toHaveBeenCalledWith("documentos");
  });
});
