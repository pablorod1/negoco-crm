import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import ImaginaRatesSync from "./ImaginaRatesSync";
import ImaginaRateSelector from "@/tramites/components/createTramite/forms/ImaginaRateSelector";
import { useImaginaRates } from "@/comercializadoras/hooks/useImaginaRates";

afterEach(() => vi.unstubAllGlobals());
const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status });

test("synchronizes from the empty contract selector and reloads without losing the form", async () => {
  const rates = [
    {
      id: "one",
      name: "Tarifa nueva",
      alias_externo: null,
      external_rate_id: "1",
      codigo_atr: "2.0TD",
      descripcion: null,
      synced_at: "2026-09-15T10:00:00Z",
    },
  ];
  const data = {
    integration: { enabled: true, configured: true },
    rates: [],
    unavailable_selected_rate: null,
  };
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(response({ success: true, data }))
    .mockResolvedValueOnce(
      response({
        success: true,
        data: { count: 1, added: 1, updated: 0, deactivated: 0 },
      }),
    )
    .mockResolvedValueOnce(
      response({ success: true, data: { ...data, rates } }),
    );
  vi.stubGlobal("fetch", fetchMock);
  function Form() {
    const result = useImaginaRates({ enabled: true });
    return (
      <>
        <input aria-label="Notas" defaultValue="Mi contrato" />
        {result.integration && (
          <ImaginaRateSelector rates={result.rates} onChange={vi.fn()} />
        )}
      </>
    );
  }
  render(<Form />);
  await screen.findByRole("alert");
  fireEvent.change(screen.getByLabelText("Notas"), {
    target: { value: "Datos conservados" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Sincronizar tarifas" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  expect(fetchMock.mock.calls[1]).toEqual([
    "/api/v2/integrations/imagina-energia/tarifas",
    { method: "POST" },
  ]);
  await screen.findByText(/1 nuevas, 0 actualizadas y 0 retiradas/);
  expect(screen.getByLabelText("Notas")).toHaveValue("Datos conservados");
  expect(
    screen.queryByText(/No hay tarifas disponibles/),
  ).not.toBeInTheDocument();
  expect(screen.getByText(/Última sincronización/)).toBeInTheDocument();
});

test("disables duplicate submissions and allows retry after failure", async () => {
  let resolve!: (value: Response) => void;
  const fetchMock = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        }),
    )
    .mockResolvedValueOnce(response({ success: true, data: { count: 0 } }));
  vi.stubGlobal("fetch", fetchMock);
  render(<ImaginaRatesSync rates={[]} />);
  fireEvent.click(screen.getByRole("button", { name: "Sincronizar tarifas" }));
  const pending = screen.getByRole("button", { name: "Sincronizando…" });
  expect(pending).toBeDisabled();
  fireEvent.click(pending);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await act(async () => resolve(response({ success: false }, 502)));
  expect(screen.getByText(/No se pudieron sincronizar/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Sincronizar tarifas" }));
  await screen.findByText(
    /Imagina no devuelve tarifas disponibles para este canal/,
  );
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
