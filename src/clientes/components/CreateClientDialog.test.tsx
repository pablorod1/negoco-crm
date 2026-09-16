import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import CreateClientDialog from "./CreateClientDialog";

vi.mock("@/core/contexts/UserContext", () => ({
  useUser: () => ({ userData: { id: "user-1" } }),
}));
vi.mock("@/core/components/CustomToast", () => ({ showCustomToast: vi.fn() }));
vi.mock("@/core/components/LoadingStateModal", () => ({ default: () => null }));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test("creates a company with the selected fiscal address and holder and signer fields", async () => {
  vi.useFakeTimers();
  const candidate = {
    id: "1", type: "portal", label: "CALLE MAYOR 1, Madrid",
    address: "CALLE MAYOR 1", tipo_via_cnmc: "Calle", calle: "MAYOR",
    numero_finca: "1", postal_code: "28013", city: "Madrid", province: "Madrid",
  };
  const fetchMock = vi.fn().mockImplementation(async (_url, options) => ({
    ok: true,
    json: async () => options?.method === "PUT"
      ? { success: true } : { success: true, data: [candidate] },
  }));
  vi.stubGlobal("fetch", fetchMock);
  render(<CreateClientDialog isOpen onClose={vi.fn()} />);
  fireEvent.click(screen.getByRole("combobox", { name: /^Tipo/ }));
  fireEvent.click(screen.getByRole("option", { name: "Empresa" }));
  fireEvent.click(screen.getByRole("combobox", { name: /^Documento/ }));
  fireEvent.click(screen.getByRole("option", { name: "CIF" }));
  const setField = (name: string, value: string) => {
    const input = document.querySelector(`input[name="${name}"]`);
    expect(input).not.toBeNull();
    fireEvent.change(input!, { target: { value } });
  };
  setField("name", "Empresa de prueba");
  setField("signer.name", "Ana");
  setField("phone_prefix", "34");
  setField("signer.phone_prefix", "34");
  setField("cnae", "6201");
  fireEvent.click(screen.getByRole("combobox", { name: "Tipo de documento" }));
  fireEvent.click(screen.getByRole("option", { name: "NIE" }));
  await act(async () => { await vi.advanceTimersByTimeAsync(50); });
  const address = screen.getByRole("combobox", { name: "Dirección fiscal" });
  act(() => address.focus());
  fireEvent.change(address, { target: { value: "Calle Mayor 1 Madrid" } });
  expect(fetchMock).not.toHaveBeenCalled();
  await act(async () => { await vi.advanceTimersByTimeAsync(350); });
  fireEvent.click(screen.getByRole("option", { name: /CALLE MAYOR 1/ }));
  expect(document.querySelector('input[name="postal_code"]')).toHaveValue("28013");
  expect(document.querySelector('input[name="city"]')).toHaveValue("Madrid");
  expect(document.querySelector('input[name="province"]')).toHaveValue("Madrid");
  setField("aclarador_finca", "2º B");
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Crear cliente" })); });
  const request = fetchMock.mock.calls.find(([, options]) => options?.method === "PUT");
  expect(request).toBeDefined();
  const payload = JSON.parse(request![1].body);
  expect(payload.client).toMatchObject({
    address: candidate.address, tipo_via_cnmc: "Calle", calle: "MAYOR",
    numero_finca: "1", postal_code: "28013", city: "Madrid", province: "Madrid",
    aclarador_finca: "2º B", cnae: "6201", phone_prefix: "34",
  });
  expect(payload.signer).toMatchObject({ name: "Ana", document_type: "NIE", phone_prefix: "34" });
});
