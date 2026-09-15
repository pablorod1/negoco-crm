import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createEmptyContractDB } from "@/tramites/utils/tramite.factories";
import type { ContractDB } from "@/tramites/types";
import ContractAddressFields from "./ContractAddressFields";

const candidate = {
  id: "1",
  type: "portal",
  label: "CALLE MAYOR 1, Madrid",
  address: "CALLE MAYOR 1",
  calle: "MAYOR",
  tipo_via_cnmc: "Calle",
  numero_finca: "1",
  postal_code: "28013",
  city: "Madrid",
  province: "Madrid",
};
const fetchMock = vi.fn();
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const advance = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(350);
  });

function renderField() {
  const onChange = vi.fn();
  function Harness() {
    const [data, setData] = React.useState<ContractDB>({
      ...createEmptyContractDB(),
      calle: "Antigua",
      numero_finca: "99",
      postal_code: "08001",
    });
    return (
      <ContractAddressFields
        formData={data}
        onChange={(fields) => {
          onChange(fields);
          setData((prev) => ({ ...prev, ...fields }));
        }}
      />
    );
  }
  render(<Harness />);
  return {
    input: screen.getByRole("combobox", { name: /Dirección/ }),
    onChange,
  };
}

test("debounces the standard address and applies every field using the keyboard", async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, data: [candidate] }),
  });
  const { input, onChange } = renderField();
  fireEvent.change(input, { target: { value: "Calle" } });
  fireEvent.change(input, { target: { value: "Calle Mayor 1 Madrid" } });
  expect(fetchMock).not.toHaveBeenCalled();
  await advance();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("option")).toHaveTextContent(candidate.label);
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(onChange).toHaveBeenLastCalledWith({
    address: candidate.address,
    calle: "MAYOR",
    numero_finca: "1",
    tipo_via_cnmc: "Calle",
    postal_code: "28013",
    city: "Madrid",
    province: "Madrid",
    aclarador_finca: "",
  });
  expect(input).toHaveValue(candidate.address);
  expect(screen.queryByRole("option")).not.toBeInTheDocument();
  await advance();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("ignores an older response after editing and clears stale structured data", async () => {
  let resolveOld!: (value: unknown) => void;
  fetchMock.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveOld = resolve;
      }),
  );
  const { input, onChange } = renderField();
  fireEvent.change(input, { target: { value: "Calle Mayor" } });
  await advance();
  fireEvent.change(input, { target: { value: "Ca" } });
  await act(async () => {
    resolveOld({
      ok: true,
      json: async () => ({ success: true, data: [candidate] }),
    });
  });
  expect(screen.queryByRole("option")).not.toBeInTheDocument();
  expect(onChange).toHaveBeenLastCalledWith({
    address: "Ca",
    calle: "",
    numero_finca: "",
    tipo_via_cnmc: "",
  });
});

test("replaces missing candidate values and synchronizes manual corrections", async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({
      success: true,
      data: [{ ...candidate, postal_code: "", numero_finca: "" }],
    }),
  });
  const { input, onChange } = renderField();
  fireEvent.change(input, { target: { value: "Calle Mayor" } });
  await advance();
  fireEvent.click(screen.getByRole("option"));
  expect(onChange).toHaveBeenLastCalledWith(
    expect.objectContaining({ postal_code: "", numero_finca: "" }),
  );
  fireEvent.change(screen.getByLabelText("Número"), {
    target: { value: "12" },
  });
  expect(input).toHaveValue("Calle MAYOR 12");
});

test("shows failure and keeps manual input usable", async () => {
  fetchMock.mockRejectedValue(new Error("offline"));
  const { input } = renderField();
  fireEvent.change(input, { target: { value: "Calle Nueva 12" } });
  await advance();
  expect(screen.getByRole("alert")).toHaveTextContent("manualmente");
  expect(input).toHaveValue("Calle Nueva 12");
});
