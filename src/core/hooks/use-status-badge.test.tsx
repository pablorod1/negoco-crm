import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/react";
import { getStatusBadge } from "./use-status-badge";

describe("getStatusBadge comparativa", () => {
  test("renders 'Rechazado Cliente' for rechazado_cliente status", () => {
    const { container } = render(
      <>{getStatusBadge("rechazado_cliente", "comparativa")}</>,
    );
    expect(container.textContent).toBe("Rechazado Cliente");
  });
});
