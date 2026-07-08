import { parseCsv, ApoloSipsCsvError } from "./csv";
import { getApoloSipsBaseCups } from "./cups";
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
  supplyType: ApoloSipsSupplyType;
}

export async function fetchApoloSipsProcedure({
  apiKey,
  cups,
  procedure,
  supplyType,
}: FetchApoloSipsProcedureParams): Promise<
  ApoloSipsProcedureResult<ApoloSipsProcedureRow>
> {
  let response: Response;

  try {
    response = await fetch(APOLO_SIPS_ENDPOINT, {
      method: "POST",
      headers: {
        accept: "*/*",
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        Procedimiento: procedure,
        TipoSuministro: supplyType,
        CUPS: getApoloSipsBaseCups(cups),
      }),
    });
  } catch {
    throw new ApoloSipsUpstreamError("No se pudo contactar con SIPS.");
  }

  const rawText = await response.text();

  if (!response.ok) {
    throw new ApoloSipsUpstreamError(
      "SIPS ha rechazado la consulta.",
      response.status,
    );
  }

  try {
    return normalizeApoloSipsCsv(parseCsv(rawText), procedure, supplyType);
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
