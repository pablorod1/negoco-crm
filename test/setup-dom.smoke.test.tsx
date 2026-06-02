import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";

describe("dom setup", () => {
  test("renders a React element into happy-dom", () => {
    render(<button type="button">Hola</button>);
    expect(screen.getByRole("button", { name: "Hola" })).toBeInTheDocument();
  });
});
