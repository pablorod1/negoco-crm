import { describe, expect, test } from "vitest";
import {
  mapContractCallbackToNegoco,
  mapImaginaStateToNegoco,
  mapScoringCodeToNegoco,
} from "./state-mapper";

describe("Imagina state mapper", () => {
  test("maps signature sent callback to Pendiente de Firma", () => {
    const result = mapContractCallbackToNegoco({
      request_id: 1,
      credit_result: { result_code: 1, result_operation: "Aprobado" },
      contrato_result: {
        result_operation: "OK",
        content: { id: 99, codigo: "C-99" },
      },
      firma_result: {
        result_code: 1,
        result_operation: "Contrato enviado para firma digital",
      },
    });

    expect(result.status).toBe("Pendiente de Firma");
  });

  test("maps signed and activable states to Procesando", () => {
    expect(mapImaginaStateToNegoco({ estadoId: 1, subestadoId: 50 }).status).toBe(
      "Procesando",
    );
    expect(mapImaginaStateToNegoco({ estadoId: 2, subestadoId: 3 }).status).toBe(
      "Procesando",
    );
  });

  test("maps active state to Activo", () => {
    expect(mapImaginaStateToNegoco({ estadoId: 3, subestadoId: 9 }).status).toBe(
      "Activo",
    );
  });

  test("maps denied scoring to Scoring", () => {
    expect(mapScoringCodeToNegoco(3).status).toBe("Scoring");
    expect(mapImaginaStateToNegoco({ estadoId: 4, subestadoId: 24 }).status).toBe(
      "Scoring",
    );
  });

  test("maps recoverable incidents and definitive cancellations", () => {
    expect(mapImaginaStateToNegoco({ estadoId: 2, subestadoId: 6 }).status).toBe(
      "Incidencia",
    );
    expect(mapImaginaStateToNegoco({ estadoId: 4, subestadoId: 16 }).status).toBe(
      "KO",
    );
  });
});
