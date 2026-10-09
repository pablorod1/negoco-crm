// @vitest-environment node
import { describe, expect, test, vi } from "vitest";

vi.mock("./read-invoice", () => ({
  // Una foto en la que el OCR no ha leído el CUPS.
  readInvoice: vi.fn(async () => ({
    text: "DETALLE DE FACTURA\nEnergía consumida\t300 kWh x 0,150000 €/kWh\t45,00 €\nTOTAL IMPORTE FACTURA\t60,00 €",
    fromImage: true,
  })),
}));

import { analyzeInvoice, StudyError, type SipsFetcher } from "./service";

const run = (fetchSips: SipsFetcher, cups?: string) =>
  analyzeInvoice({
    client: { execute: vi.fn(), batch: vi.fn() } as never,
    tenantSlug: "test",
    comparativaId: "CMP-1",
    userId: "user-1",
    invoice: { data: new Uint8Array(), fileName: "foto.jpg", fileId: null, mime: "image/jpeg", cups },
    channel: "acquisition",
    today: "2026-10-09",
    fetchSips,
  });

describe("CUPS that the invoice does not show", () => {
  test("stops before SIPS and asks for it on the same screen", async () => {
    const fetchSips = vi.fn<SipsFetcher>(async () => null);
    const error = await run(fetchSips).catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(StudyError);
    expect((error as StudyError).code).toBe("cups_missing");
    expect(fetchSips).not.toHaveBeenCalled();
  });

  test("a typed CUPS is the one asked to SIPS", async () => {
    const fetchSips = vi.fn<SipsFetcher>(async () => null);
    // Sin respuesta del SIPS el análisis se para ahí: basta para ver qué CUPS se pidió.
    await expect(run(fetchSips, "ES0021000000000001RK")).rejects.toMatchObject({ status: 503 });
    expect(fetchSips).toHaveBeenCalledWith("ES0021000000000001RK", "CONSUMOS");
  });
});
