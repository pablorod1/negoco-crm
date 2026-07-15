import { useEffect, useReducer, useRef } from "react";

import type {
  ImaginaRate,
  ImaginaRatesListData,
} from "@/comercializadoras/types";

export interface UseImaginaRatesOptions {
  enabled: boolean;
  historicalRateId?: string;
}

const ENDPOINT = "/api/v2/integrations/imagina-energia/tarifas/list";
const DEFAULT_ERROR = "Error al cargar las tarifas de Imagina";
const EMPTY_RATES: ImaginaRate[] = [];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNullableString = (value: unknown): value is string | null =>
  typeof value === "string" || value === null;

const isImaginaRate = (value: unknown): value is ImaginaRate =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.name === "string" &&
  isNullableString(value.external_rate_id) &&
  isNullableString(value.alias_externo) &&
  isNullableString(value.codigo_atr) &&
  isNullableString(value.descripcion) &&
  isNullableString(value.synced_at);

const isAvailableImaginaRate = (value: unknown): value is ImaginaRate =>
  isImaginaRate(value) &&
  typeof value.external_rate_id === "string" &&
  value.external_rate_id.trim().length > 0 &&
  typeof value.synced_at === "string" &&
  value.synced_at.trim().length > 0;

const isImaginaRatesListData = (
  value: unknown,
): value is ImaginaRatesListData =>
  isRecord(value) &&
  isRecord(value.integration) &&
  typeof value.integration.enabled === "boolean" &&
  typeof value.integration.configured === "boolean" &&
  Array.isArray(value.rates) &&
  value.rates.every(isAvailableImaginaRate) &&
  (value.unavailable_selected_rate === null ||
    isImaginaRate(value.unavailable_selected_rate));

interface ImaginaRatesRequest {
  requestKey: string;
  generation: number;
}

type ImaginaRatesRequestState =
  | { status: "idle" }
  | { status: "loading"; request: ImaginaRatesRequest }
  | {
      status: "success";
      request: ImaginaRatesRequest;
      data: ImaginaRatesListData;
    }
  | { status: "error"; request: ImaginaRatesRequest; error: string };

type ImaginaRatesRequestAction =
  | { type: "started"; request: ImaginaRatesRequest }
  | {
      type: "succeeded";
      request: ImaginaRatesRequest;
      data: ImaginaRatesListData;
    }
  | { type: "failed"; request: ImaginaRatesRequest; error: string };

const isCurrentRequest = (
  state: ImaginaRatesRequestState,
  request: ImaginaRatesRequest,
) =>
  state.status !== "idle" &&
  state.request.requestKey === request.requestKey &&
  state.request.generation === request.generation;

const requestStateReducer = (
  state: ImaginaRatesRequestState,
  action: ImaginaRatesRequestAction,
): ImaginaRatesRequestState => {
  switch (action.type) {
    case "started":
      return { status: "loading", request: action.request };
    case "succeeded":
      return isCurrentRequest(state, action.request)
        ? {
            status: "success",
            request: action.request,
            data: action.data,
          }
        : state;
    case "failed":
      return isCurrentRequest(state, action.request)
        ? {
            status: "error",
            request: action.request,
            error: action.error,
          }
        : state;
  }
};

export function useImaginaRates({
  enabled,
  historicalRateId,
}: UseImaginaRatesOptions) {
  const [state, dispatch] = useReducer(requestStateReducer, { status: "idle" });
  const generationRef = useRef(0);
  const requestKey = historicalRateId
    ? `${ENDPOINT}?${new URLSearchParams({ selected_rate_id: historicalRateId })}`
    : ENDPOINT;

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();
    const request = {
      requestKey,
      generation: generationRef.current + 1,
    };
    generationRef.current = request.generation;
    dispatch({ type: "started", request });

    const fetchRates = async () => {
      let errorMessage = DEFAULT_ERROR;

      try {
        const response = await fetch(requestKey, {
          signal: controller.signal,
        });
        const result: unknown = await response.json().catch(() => null);
        const apiError =
          isRecord(result) &&
          typeof result.error === "string" &&
          result.error.trim()
            ? result.error
            : null;

        if (
          !response.ok ||
          !isRecord(result) ||
          result.success !== true
        ) {
          errorMessage = apiError ?? DEFAULT_ERROR;
          throw new Error(errorMessage);
        }

        if (!isImaginaRatesListData(result.data)) {
          throw new Error(DEFAULT_ERROR);
        }

        if (controller.signal.aborted) return;
        dispatch({ type: "succeeded", request, data: result.data });
      } catch {
        if (controller.signal.aborted) return;

        dispatch({ type: "failed", request, error: errorMessage });
      }
    };

    void fetchRates();

    return () => controller.abort();
  }, [enabled, requestKey]);

  const currentState =
    enabled && state.status !== "idle" && state.request.requestKey === requestKey
      ? state
      : null;
  const data = currentState?.status === "success" ? currentState.data : null;

  return {
    data,
    integration: data?.integration ?? null,
    rates: data?.rates ?? EMPTY_RATES,
    unavailableSelectedRate: data?.unavailable_selected_rate ?? null,
    loading:
      enabled && (currentState === null || currentState.status === "loading"),
    error: currentState?.status === "error" ? currentState.error : null,
  };
}
