// @vitest-environment node
import { describe, expect, test, vi } from "vitest";
import { naturgyInvoice } from "@/comparador/extraction/fixtures";
import type { InvoiceExtraction } from "@/comparador/extraction/invoice-schema";

const page = { data: new Uint8Array([1, 2, 3]), mediaType: "image/jpeg" as const };

vi.mock("./read-invoice", () => ({
  // Visión encendida: la foto va entera a la IA, sin OCR.
  photoVisionEnabled: () => true,
  invoiceImagesForVision: vi.fn(async () => [page]),
  zoomedBands: vi.fn(async () => []),
  readInvoice: vi.fn(async () => {
    throw new Error("con visión no se lee con OCR");
  }),
}));

import { analyzeInvoice, StudyError, type SipsFetcher } from "./service";

const VALID_CUPS = "ES0021000015543129GW";

function run(read: Partial<InvoiceExtraction>, cups?: string) {
  const extract = vi.fn(async () => ({
    status: "ok" as const,
    extraction: { ...naturgyInvoice, ...read },
    issues: [],
    attempts: [],
  }));
  const fetchSips = vi.fn<SipsFetcher>(async () => null);
  const result = analyzeInvoice({
    client: { execute: vi.fn(), batch: vi.fn() } as never,
    tenantSlug: "test",
    comparativaId: "CMP-1",
    userId: "user-1",
    invoice: { data: new Uint8Array(), fileName: "foto.jpg", fileId: null, mime: "image/jpeg", cups },
    channel: "acquisition",
    today: "2026-10-14",
    fetchSips,
    extract: extract as never,
  });
  return { result, extract, fetchSips };
}

describe("photos read with vision", () => {
  test("sends the photo itself and asks SIPS for the CUPS the model read", async () => {
    const { result, extract, fetchSips } = run({ cups: VALID_CUPS });
    // Sin respuesta del SIPS se para ahí: basta para ver qué se envió y qué CUPS se pidió.
    await expect(result).rejects.toMatchObject({ status: 503 });
    expect(extract).toHaveBeenCalledWith(expect.objectContaining({ file: { pages: [page], zoomed: [] } }));
    expect(fetchSips).toHaveBeenCalledWith(VALID_CUPS, "CONSUMOS", "ELECTRICIDAD");
  });

  test("without a valid CUPS it asks for it on the same screen", async () => {
    const error = await run({ cups: "ES0021000015543129ZZ" }).result.catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(StudyError);
    expect((error as StudyError).code).toBe("cups_missing");
  });

  test("a typed CUPS wins over the one read", async () => {
    const typed = "ES0021000000000001RK";
    const { result, fetchSips } = run({ cups: VALID_CUPS }, typed);
    await expect(result).rejects.toMatchObject({ status: 503 });
    expect(fetchSips).toHaveBeenCalledWith(typed, "CONSUMOS", "ELECTRICIDAD");
  });

  test("a photo without the detail lines says so", async () => {
    const error = await run({ cups: VALID_CUPS, powerLines: [], energyLines: [] }).result.catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(StudyError);
    expect((error as StudyError).message).toMatch(/no se ha podido leer el detalle/i);
  });
});

describe("photoVisionEnabled", () => {
  test("only with COMPARADOR_PHOTO_VISION=1 or true", async () => {
    const { photoVisionEnabled } = await vi.importActual<typeof import("./read-invoice")>("./read-invoice");
    expect(photoVisionEnabled({})).toBe(false);
    expect(photoVisionEnabled({ COMPARADOR_PHOTO_VISION: "0" })).toBe(false);
    expect(photoVisionEnabled({ COMPARADOR_PHOTO_VISION: "1" })).toBe(true);
    expect(photoVisionEnabled({ COMPARADOR_PHOTO_VISION: "true" })).toBe(true);
  });
});
