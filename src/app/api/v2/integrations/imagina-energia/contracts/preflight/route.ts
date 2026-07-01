import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import {
  preflightImaginaContract,
  preflightImaginaContractDraft,
  tenantFromHost,
} from "@/core/integrations/imagina-energia";
import type {
  ClientDB,
  ContractDB,
  SignerDB,
  TramiteDB,
} from "@/tramites/types";

const PersistedPreflightSchema = z.object({
  tramite_id: z.string().min(1),
  contract_id: z.string().optional().nullable(),
});

const DraftPreflightSchema = z.object({
  tramite: z.custom<TramiteDB>((value) => Boolean(value)),
  client: z.custom<ClientDB>((value) => Boolean(value)),
  contract: z.custom<ContractDB>((value) => Boolean(value)),
  signer: z.custom<SignerDB>().optional().nullable(),
});

const PreflightSchema = z.union([
  PersistedPreflightSchema,
  DraftPreflightSchema,
]);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = PreflightSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing parameters",
          details: parsed.error.issues,
        },
        { status: 400 },
      );
    }

    const db = getTursoClient(request);
    const tenant = tenantFromHost(request.headers.get("host")) || "test";
    const result =
      "tramite_id" in parsed.data
        ? await preflightImaginaContract(
            { db, tenant },
            {
              tramiteId: parsed.data.tramite_id,
              contractId: parsed.data.contract_id,
            },
          )
        : await preflightImaginaContractDraft({ db, tenant }, parsed.data);

    return NextResponse.json(result, { status: result.status || 200 });
  } catch (error) {
    console.error("Imagina contract preflight error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Error al validar el contrato para Imagina",
      },
      { status: 500 },
    );
  }
}
