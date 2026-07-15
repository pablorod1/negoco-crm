import { afterEach, describe, expect, test, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useImaginaRates } from "./useImaginaRates";

const successfulData = {
  integration: { enabled: true, configured: true },
  rates: [
    {
      id: "rate-1",
      name: "Plan Noche",
      external_rate_id: "11001",
      alias_externo: "Noche",
      codigo_atr: "2.0TD",
      descripcion: null,
      synced_at: "2026-07-14T10:00:00.000Z",
    },
  ],
  unavailable_selected_rate: null,
};

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useImaginaRates", () => {
  test("does not fetch when disabled", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useImaginaRates({ enabled: false, historicalRateId: "legacy-42" }),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current).toEqual({
      data: null,
      integration: null,
      rates: [],
      unavailableSelectedRate: null,
      loading: false,
      error: null,
    });
  });

  test("fetches and exposes the rates response when enabled", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: successfulData }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useImaginaRates({ enabled: true, historicalRateId: "legacy-42" }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/v2/integrations/imagina-energia/tarifas/list?selected_rate_id=legacy-42",
    );
    expect(fetchMock.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
    expect(result.current.data).toEqual(successfulData);
    expect(result.current.integration).toEqual(successfulData.integration);
    expect(result.current.rates).toEqual(successfulData.rates);
    expect(result.current.unavailableSelectedRate).toBeNull();
    expect(result.current.error).toBeNull();
  });

  test("accepts nullable synchronization metadata for a historical rate", async () => {
    const historicalRate = {
      id: "legacy-rate",
      name: "Tarifa antigua",
      external_rate_id: "legacy-42",
      alias_externo: null,
      codigo_atr: "2.0TD",
      descripcion: "Ya no disponible",
      synced_at: null,
    };
    const historicalData = {
      ...successfulData,
      unavailable_selected_rate: historicalRate,
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: historicalData }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useImaginaRates({ enabled: true, historicalRateId: "legacy-42" }),
    );

    await waitFor(() =>
      expect(result.current.unavailableSelectedRate).toEqual(historicalRate),
    );
    expect(result.current.data).toEqual(historicalData);
    expect(result.current.error).toBeNull();
  });

  test.each([
    {
      name: "rates is not an array",
      data: { ...successfulData, rates: {} },
    },
    {
      name: "integration has a non-boolean flag",
      data: {
        ...successfulData,
        integration: { enabled: "true", configured: true },
      },
    },
    {
      name: "a rate has an invalid field",
      data: {
        ...successfulData,
        rates: [{ ...successfulData.rates[0], synced_at: null }],
      },
    },
    {
      name: "the unavailable rate is invalid",
      data: {
        ...successfulData,
        unavailable_selected_rate: {
          ...successfulData.rates[0],
          external_rate_id: 11001,
        },
      },
    },
  ])("rejects malformed data when $name", async ({ data }) => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data,
          error: "No debe ocultar un contrato inválido",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useImaginaRates({ enabled: true }),
    );

    await waitFor(() =>
      expect(result.current.error).toBe(
        "Error al cargar las tarifas de Imagina",
      ),
    );
    expect(result.current.data).toBeNull();
    expect(result.current.rates).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  test("exposes API errors and clears response data", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ success: false, error: "Integración no disponible" }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useImaginaRates({ enabled: true }),
    );

    await waitFor(() =>
      expect(result.current.error).toBe("Integración no disponible"),
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(result.current.rates).toEqual([]);
  });

  test("rejects unsuccessful payloads even with a successful HTTP status", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ success: false, error: "Respuesta rechazada" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useImaginaRates({ enabled: true }),
    );

    await waitFor(() =>
      expect(result.current.error).toBe("Respuesta rechazada"),
    );
  });

  test.each([
    { name: "an empty response", body: null },
    { name: "a non-JSON response", body: "upstream unavailable" },
  ])("uses the stable fallback for $name", async ({ body }) => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(body, {
        status: 502,
        headers: { "Content-Type": "text/plain" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useImaginaRates({ enabled: true }),
    );

    await waitFor(() =>
      expect(result.current.error).toBe(
        "Error al cargar las tarifas de Imagina",
      ),
    );
    expect(result.current.loading).toBe(false);
  });

  test("does not let an aborted response overwrite the current request", async () => {
    const firstRequest = deferred<Response>();
    let firstRequestSignal: AbortSignal | undefined;
    const currentData = {
      ...successfulData,
      rates: [{ ...successfulData.rates[0], name: "Plan actual" }],
    };
    const staleData = {
      ...successfulData,
      rates: [{ ...successfulData.rates[0], name: "Plan obsoleto" }],
    };
    const staleResponseJson = vi.fn().mockResolvedValue({
      success: true,
      data: staleData,
    });
    const fetchMock = vi
      .fn()
      .mockImplementationOnce((_url: string, init?: RequestInit) => {
        firstRequestSignal = init?.signal ?? undefined;
        return firstRequest.promise;
      })
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, data: currentData }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { result, rerender } = renderHook(
      ({ historicalRateId }) =>
        useImaginaRates({ enabled: true, historicalRateId }),
      { initialProps: { historicalRateId: "legacy-rate" } },
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(firstRequestSignal?.aborted).toBe(false);

    rerender({ historicalRateId: "current-rate" });

    await waitFor(() => expect(result.current.data).toEqual(currentData));
    expect(firstRequestSignal?.aborted).toBe(true);

    await act(async () => {
      firstRequest.resolve(
        {
          ok: true,
          json: staleResponseJson,
        } as unknown as Response,
      );
      await firstRequest.promise;
    });

    await waitFor(() => expect(staleResponseJson).toHaveBeenCalledTimes(1));
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.data).toEqual(currentData);
    expect(result.current.rates[0]?.name).toBe("Plan actual");
  });

  test("derives an empty idle result immediately when disabled", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: successfulData }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result, rerender } = renderHook(
      ({ enabled }) => useImaginaRates({ enabled }),
      { initialProps: { enabled: true } },
    );
    await waitFor(() => expect(result.current.data).toEqual(successfulData));

    rerender({ enabled: false });

    expect(result.current).toEqual({
      data: null,
      integration: null,
      rates: [],
      unavailableSelectedRate: null,
      loading: false,
      error: null,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("starts a new generation when re-enabled with the same request key", async () => {
    const secondRequest = deferred<Response>();
    const refreshedData = {
      ...successfulData,
      rates: [{ ...successfulData.rates[0], name: "Plan renovado" }],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, data: successfulData }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockImplementationOnce(() => secondRequest.promise);
    vi.stubGlobal("fetch", fetchMock);

    const { result, rerender } = renderHook(
      ({ enabled }) =>
        useImaginaRates({ enabled, historicalRateId: "same-rate" }),
      { initialProps: { enabled: true } },
    );
    await waitFor(() => expect(result.current.data).toEqual(successfulData));

    rerender({ enabled: false });
    expect(result.current.loading).toBe(false);

    rerender({ enabled: true });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    expect(result.current.data).toBeNull();
    expect(result.current.rates).toEqual([]);
    expect(result.current.loading).toBe(true);

    await act(async () => {
      secondRequest.resolve(
        new Response(JSON.stringify({ success: true, data: refreshedData }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      await secondRequest.promise;
    });

    await waitFor(() => expect(result.current.data).toEqual(refreshedData));
    expect(result.current.rates[0]?.name).toBe("Plan renovado");
    expect(result.current.loading).toBe(false);
  });
});
