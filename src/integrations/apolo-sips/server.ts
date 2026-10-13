import { parseCsv, ApoloSipsCsvError } from "./csv";
import { getApoloSipsCupsCandidates } from "./cups";
import { normalizeApoloSipsCsv, ApoloSipsParseError } from "./normalize";
import type {
  ApoloSipsProcedure,
  ApoloSipsProcedureResult,
  ApoloSipsProcedureRow,
  ApoloSipsSupplyType,
} from "./types";

const APOLO_SIPS_ENDPOINT = "https://sips.gruporenovae.es/api/GetSIPS";

export class ApoloSipsUpstreamError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApoloSipsUpstreamError";
    this.status = status;
  }
}

interface FetchApoloSipsProcedureParams {
  apiKey: string;
  cups: string;
  procedure: ApoloSipsProcedure;
  signal?: AbortSignal;
  supplyType: ApoloSipsSupplyType;
}

export async function fetchApoloSipsProcedure({
  apiKey,
  cups,
  procedure,
  signal,
  supplyType,
}: FetchApoloSipsProcedureParams): Promise<
  ApoloSipsProcedureResult<ApoloSipsProcedureRow>
> {
  let result: ApoloSipsProcedureResult<ApoloSipsProcedureRow> | undefined;

  // Una a una y parando en la primera con datos: cada intento cuenta contra
  // el límite de peticiones por minuto de la clave.
  for (const candidate of getApoloSipsCupsCandidates(cups)) {
    result = await fetchApoloSipsProcedureForCups({
      apiKey,
      cups: candidate,
      procedure,
      signal,
      supplyType,
    });
    if (result.hasData) return result;
  }

  return result!;
}

async function fetchApoloSipsProcedureForCups({
  apiKey,
  cups,
  procedure,
  signal,
  supplyType,
}: FetchApoloSipsProcedureParams): Promise<
  ApoloSipsProcedureResult<ApoloSipsProcedureRow>
> {
  let response: Response;

  try {
    response = await fetch(APOLO_SIPS_ENDPOINT, {
      method: "POST",
      signal,
      headers: {
        accept: "*/*",
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        Procedimiento: procedure,
        TipoSuministro: supplyType,
        CUPS: cups,
      }),
    });
  } catch {
    throw new ApoloSipsUpstreamError("No se pudo contactar con SIPS.");
  }

  const rawText = await response.text();

  if (response.status === 429) {
    throw new ApoloSipsUpstreamError(
      "SIPS ha alcanzado el límite de consultas por minuto. Inténtalo de nuevo en un minuto.",
      response.status,
    );
  }

  if (!response.ok) {
    throw new ApoloSipsUpstreamError(
      "SIPS ha rechazado la consulta.",
      response.status,
    );
  }

  try {
    return {
      ...normalizeApoloSipsCsv(parseCsv(rawText), procedure, supplyType),
      cups,
    };
  } catch (error) {
    if (
      error instanceof ApoloSipsCsvError ||
      error instanceof ApoloSipsParseError
    ) {
      throw new ApoloSipsUpstreamError(
        "SIPS ha devuelto una respuesta inválida.",
        response.status,
      );
    }

    throw error;
  }
}
