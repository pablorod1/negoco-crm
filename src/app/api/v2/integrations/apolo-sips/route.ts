import { NextRequest, NextResponse } from "next/server";
import { validateUserSession } from "@/core/auth/session-utils";
import { ApoloSipsRequestSchema } from "@/integrations/apolo-sips/schemas";
import {
  ApoloSipsUpstreamError,
  fetchApoloSipsProcedure,
} from "@/integrations/apolo-sips/server";
import type {
  ApoloSipsApiResponse,
  ApoloSipsElectricityConsumptionRow,
  ApoloSipsElectricityPointSupplyRow,
  ApoloSipsGasConsumptionRow,
  ApoloSipsGasPointSupplyRow,
  ApoloSipsProcedureResult,
  ApoloSipsProcedureRow,
  ApoloSipsResponseData,
  ApoloSipsSupplyType,
} from "@/integrations/apolo-sips/types";

export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApoloSipsApiResponse>> {
  try {
    const sessionResult = await validateUserSession(request);
    if (!sessionResult.user) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "JSON inválido." },
        { status: 400 },
      );
    }

    const validation = ApoloSipsRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Payload inválido.",
          details: validation.error.issues,
        },
        { status: 400 },
      );
    }

    const apiKey = process.env.APOLO_SIPS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "Missing API key." },
        { status: 500 },
      );
    }

    const { cups, tipoSuministro, procedimientos } = validation.data;

    let results: ApoloSipsProcedureResult<ApoloSipsProcedureRow>[];
    try {
      results = await Promise.all(
        procedimientos.map((procedure) =>
          fetchApoloSipsProcedure({
            apiKey,
            cups,
            procedure,
            supplyType: tipoSuministro,
          }),
        ),
      );
    } catch (error) {
      if (error instanceof ApoloSipsUpstreamError) {
        console.error("[apolo-sips] upstream error", {
          status: error.status,
          message: error.message,
        });
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 502 },
        );
      }

      throw error;
    }

    return NextResponse.json({
      success: true,
      data: buildResponseData(cups, tipoSuministro, results),
    });
  } catch (error) {
    console.error(
      "[apolo-sips] unexpected error",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { success: false, error: "Error interno del servidor." },
      { status: 500 },
    );
  }
}

function buildResponseData(
  cups: string,
  tipoSuministro: ApoloSipsSupplyType,
  results: ApoloSipsProcedureResult<ApoloSipsProcedureRow>[],
): ApoloSipsResponseData {
  if (tipoSuministro === "ELECTRICIDAD") {
    const data: Extract<
      ApoloSipsResponseData,
      { tipoSuministro: "ELECTRICIDAD" }
    > = {
      cups,
      tipoSuministro,
    };

    for (const result of results) {
      if (result.procedure === "PS") {
        data.ps =
          result as ApoloSipsProcedureResult<ApoloSipsElectricityPointSupplyRow>;
      } else {
        data.consumos =
          result as ApoloSipsProcedureResult<ApoloSipsElectricityConsumptionRow>;
      }
    }

    return data;
  }

  const data: Extract<ApoloSipsResponseData, { tipoSuministro: "GAS" }> = {
    cups,
    tipoSuministro,
  };

  for (const result of results) {
    if (result.procedure === "PS") {
      data.ps = result as ApoloSipsProcedureResult<ApoloSipsGasPointSupplyRow>;
    } else {
      data.consumos =
        result as ApoloSipsProcedureResult<ApoloSipsGasConsumptionRow>;
    }
  }

  return data;
}
