import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { ComercializadoraViewToggle } from "./ComercializadoraViewToggle";

describe("ComercializadoraViewToggle", () => {
  test("keeps the rates option hidden by default", () => {
    render(
      <ComercializadoraViewToggle
        currentView="main"
        onViewChange={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Tarifas" }),
    ).not.toBeInTheDocument();
  });

  test("shows and selects the rates option when enabled by the parent", () => {
    const onViewChange = vi.fn();

    render(
      <ComercializadoraViewToggle
        currentView="main"
        onViewChange={onViewChange}
        showRates
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Tarifas" }));

    expect(onViewChange).toHaveBeenCalledWith("tarifas");
  });
});
