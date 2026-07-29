import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { SelectComponent } from "./InputComponent";

describe("SelectComponent", () => {
  test("associates its label with the select trigger", () => {
    render(
      <SelectComponent
        name="status"
        label="Estado"
        items={[{ value: "pending", label: "Pendiente" }]}
        onChange={vi.fn()}
        selectedKey="pending"
        textValue="Pendiente"
      />,
    );

    expect(screen.getByLabelText("Estado")).toHaveAttribute("id", "status");
  });
});
