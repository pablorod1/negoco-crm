import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, test } from "vitest";
import { Input } from "./input";

function ControlledInput({ uppercase }: { uppercase?: boolean }) {
  const [value, setValue] = useState("");
  return (
    <>
      <Input
        aria-label="campo"
        uppercase={uppercase}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <output>{value}</output>
    </>
  );
}

describe("Input uppercase", () => {
  test("stores the typed value in uppercase, including ñ and accents", () => {
    render(<ControlledInput uppercase />);
    const input = screen.getByLabelText("campo");

    fireEvent.change(input, { target: { value: "josé peña" } });

    expect(input).toHaveValue("JOSÉ PEÑA");
    expect(screen.getByRole("status")).toHaveTextContent("JOSÉ PEÑA");
  });

  test("leaves the value untouched without the prop", () => {
    render(<ControlledInput />);
    const input = screen.getByLabelText("campo");

    fireEvent.change(input, { target: { value: "josé" } });

    expect(screen.getByRole("status")).toHaveTextContent("josé");
  });

  test("converts after a composition ends (dead-key accents)", () => {
    render(<ControlledInput uppercase />);
    const input = screen.getByLabelText("campo") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "jos" } });
    fireEvent.input(input, {
      target: { value: "JOSé" },
      isComposing: true,
    });
    expect(screen.getByRole("status")).toHaveTextContent("JOSé");

    fireEvent.compositionEnd(input);

    expect(input).toHaveValue("JOSÉ");
    expect(screen.getByRole("status")).toHaveTextContent("JOSÉ");
  });
});
