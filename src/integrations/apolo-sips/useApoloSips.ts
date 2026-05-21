"use client";

import { useCallback, useState } from "react";
import type {
  ApoloSipsApiRequest,
  ApoloSipsApiResponse,
  ApoloSipsBaseRequest,
  ApoloSipsProcedure,
  ApoloSipsResponseData,
} from "./types";

interface UseApoloSipsState {
  data: ApoloSipsResponseData | null;
  loading: boolean;
  error: string | null;
  lastRequest: ApoloSipsApiRequest | null;
}

interface UseApoloSipsReturn extends UseApoloSipsState {
  fetchPs: (
    request: ApoloSipsBaseRequest,
  ) => Promise<ApoloSipsResponseData | null>;
  fetchConsumptions: (
    request: ApoloSipsBaseRequest,
  ) => Promise<ApoloSipsResponseData | null>;
  fetchAll: (
    request: ApoloSipsBaseRequest,
  ) => Promise<ApoloSipsResponseData | null>;
  reset: () => void;
}

const INITIAL_STATE: UseApoloSipsState = {
  data: null,
  loading: false,
  error: null,
  lastRequest: null,
};

export function useApoloSips(): UseApoloSipsReturn {
  const [state, setState] = useState<UseApoloSipsState>(INITIAL_STATE);

  const execute = useCallback(
    async (
      request: ApoloSipsBaseRequest,
      procedimientos: ApoloSipsProcedure[],
    ): Promise<ApoloSipsResponseData | null> => {
      const apiRequest: ApoloSipsApiRequest = {
        ...request,
        procedimientos,
      };

      setState((previous) => ({
        ...previous,
        loading: true,
        error: null,
        lastRequest: apiRequest,
      }));

      try {
        const response = await fetch("/api/v2/integrations/apolo-sips", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(apiRequest),
        });

        const result = (await response.json()) as ApoloSipsApiResponse;

        if (!result.success) {
          const error = result.error || "Error al consultar Apolo SIPS.";
          setState((previous) => ({
            ...previous,
            data: null,
            loading: false,
            error,
          }));
          return null;
        }

        setState((previous) => ({
          ...previous,
          data: result.data,
          loading: false,
          error: null,
        }));

        return result.data;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Error de conexión al consultar Apolo SIPS.";

        setState((previous) => ({
          ...previous,
          data: null,
          loading: false,
          error: message,
        }));

        return null;
      }
    },
    [],
  );

  const fetchPs = useCallback(
    (request: ApoloSipsBaseRequest) => execute(request, ["PS"]),
    [execute],
  );

  const fetchConsumptions = useCallback(
    (request: ApoloSipsBaseRequest) => execute(request, ["CONSUMOS"]),
    [execute],
  );

  const fetchAll = useCallback(
    (request: ApoloSipsBaseRequest) => execute(request, ["PS", "CONSUMOS"]),
    [execute],
  );

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  return {
    ...state,
    fetchPs,
    fetchConsumptions,
    fetchAll,
    reset,
  };
}
