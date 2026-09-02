import { describe, expect, test } from "vitest";
import {
  decodeDocumentBase64,
  MAX_INLINE_DOCUMENT_BYTES,
  MAX_STAGED_DOCUMENT_BYTES,
  QUARANTINE_CONTENT_TYPE,
  resolveAbarcaDocument,
  resolveAbarcaDocuments,
  sniffDocumentContentType,
  attachDocumentsToRawPayload,
  mergeDocumentsIntoRawPayload,
  parseAbarcaDocuments,
  type StagedDocumentRef,
} from "./abarca-documents";

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const png = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
]);
const pdf = Buffer.from("%PDF-1.7\nbody", "latin1");

function stagedRef(overrides: Partial<StagedDocumentRef> = {}) {
  return {
    path: "abarca-inbox/tenant/comparison-1/delivery-1/dni_photo_back.png",
    url: "https://storage.example/staged.png",
    bytes: 2048,
    content_type: "image/png",
    ...overrides,
  };
}

describe("decodeDocumentBase64", () => {
  test("decodes plain base64", () => {
    expect(decodeDocumentBase64(jpeg.toString("base64"))).toEqual(jpeg);
  });

  test("decodes a data URI, which the previous validation rejected", () => {
    const value = `data:image/jpeg;base64,${jpeg.toString("base64")}`;

    expect(decodeDocumentBase64(value)).toEqual(jpeg);
  });

  test("decodes line-wrapped base64", () => {
    const wrapped = pdf
      .toString("base64")
      .replace(/(.{4})/g, "$1\n");

    expect(decodeDocumentBase64(wrapped)).toEqual(pdf);
  });

  test("decodes base64url without padding", () => {
    const value = png
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    expect(decodeDocumentBase64(value)).toEqual(png);
  });

  test("rejects values that are not base64 at all", () => {
    expect(decodeDocumentBase64("not base64 ***")).toBeNull();
    expect(decodeDocumentBase64("")).toBeNull();
  });
});

describe("sniffDocumentContentType", () => {
  test.each([
    ["image/jpeg", jpeg],
    ["image/png", png],
    ["application/pdf", pdf],
  ])("identifies %s by magic bytes", (expected, buffer) => {
    expect(sniffDocumentContentType(buffer)).toBe(expected);
  });

  test("accepts a JPEG with trailing bytes after the EOI marker", () => {
    const withTrailer = Buffer.concat([
      jpeg,
      Buffer.from([0xff, 0xd9]),
      Buffer.from("trailing exif garbage"),
    ]);

    expect(sniffDocumentContentType(withTrailer)).toBe("image/jpeg");
  });

  test("returns null for an unrecognised format such as HEIC", () => {
    const heic = Buffer.concat([
      Buffer.from([0x00, 0x00, 0x00, 0x18]),
      Buffer.from("ftypheic"),
    ]);

    expect(sniffDocumentContentType(heic)).toBeNull();
  });
});

describe("resolveAbarcaDocument", () => {
  test("plans a PNG sent in the JPEG-only DNI field", () => {
    const outcome = resolveAbarcaDocument(
      "dni_photo_front",
      png.toString("base64"),
      "Acme",
    );

    expect(outcome).toMatchObject({
      status: "planned",
      plan: {
        contentType: "image/png",
        extension: "png",
        filename: "dni_frontal.png",
        quarantined: false,
        size: png.length,
      },
    });
  });

  test("plans a PDF sent in the DNI field", () => {
    const outcome = resolveAbarcaDocument(
      "dni_photo_back",
      pdf.toString("base64"),
      null,
    );

    expect(outcome).toMatchObject({
      status: "planned",
      plan: { extension: "pdf", filename: "dni_reverso.pdf" },
    });
  });

  test("names the study after the company", () => {
    const outcome = resolveAbarcaDocument(
      "comparativa_pdf",
      pdf.toString("base64"),
      "Iberdrola España",
    );

    expect(outcome).toMatchObject({
      status: "planned",
      plan: { filename: "estudio_Iberdrola_Espana.pdf" },
    });
  });

  test("quarantines unrecognised bytes instead of discarding them", () => {
    const heic = Buffer.concat([
      Buffer.from([0x00, 0x00, 0x00, 0x18]),
      Buffer.from("ftypheic"),
    ]);

    const outcome = resolveAbarcaDocument(
      "dni_photo_back",
      heic.toString("base64"),
      null,
    );

    expect(outcome).toMatchObject({
      status: "planned",
      plan: {
        contentType: QUARANTINE_CONTENT_TYPE,
        extension: "bin",
        quarantined: true,
        reason: "unrecognized_document_bytes",
      },
    });
  });

  test("reports missing documents distinctly from invalid ones", () => {
    expect(resolveAbarcaDocument("justo_titulo", null, null)).toEqual({
      status: "missing",
    });
    expect(resolveAbarcaDocument("justo_titulo", undefined, null)).toEqual({
      status: "missing",
    });
    expect(resolveAbarcaDocument("justo_titulo", "", null)).toEqual({
      status: "missing",
    });
    expect(resolveAbarcaDocument("justo_titulo", 42, null)).toEqual({
      status: "invalid",
      reason: "unsupported_document_shape",
    });
  });

  test("rejects inline documents past the Vercel body budget", () => {
    const oversized = Buffer.alloc(MAX_INLINE_DOCUMENT_BYTES + 1, 0x41);
    oversized.set(jpeg, 0);

    expect(
      resolveAbarcaDocument(
        "dni_photo_front",
        oversized.toString("base64"),
        null,
      ),
    ).toMatchObject({ status: "invalid" });
  });

  test("plans a staged document uploaded by the ingest proxy", () => {
    const ref = stagedRef();

    expect(resolveAbarcaDocument("dni_photo_back", ref, null)).toMatchObject({
      status: "planned",
      plan: {
        contentType: "image/png",
        extension: "png",
        filename: "dni_reverso.png",
        quarantined: false,
        size: 2048,
        source: { kind: "staged", ref },
      },
    });
  });

  test("quarantines a staged document with an unknown content type", () => {
    const outcome = resolveAbarcaDocument(
      "dni_photo_back",
      stagedRef({ content_type: "image/heic" }),
      null,
    );

    expect(outcome).toMatchObject({
      status: "planned",
      plan: {
        contentType: QUARANTINE_CONTENT_TYPE,
        quarantined: true,
        reason: "unknown_content_type:image/heic",
      },
    });
  });

  test("rejects staged documents past the proxy budget", () => {
    expect(
      resolveAbarcaDocument(
        "dni_photo_back",
        stagedRef({ bytes: MAX_STAGED_DOCUMENT_BYTES + 1 }),
        null,
      ),
    ).toMatchObject({ status: "invalid" });
  });
});

describe("resolveAbarcaDocuments", () => {
  test("resolves each document independently", () => {
    const outcomes = resolveAbarcaDocuments(
      {
        comparativa_pdf: pdf.toString("base64"),
        dni_photo_front: png.toString("base64"),
        dni_photo_back: "###",
        justo_titulo: null,
      },
      "Acme",
    );

    expect(outcomes.get("comparativa_pdf")?.status).toBe("planned");
    expect(outcomes.get("dni_photo_front")?.status).toBe("planned");
    expect(outcomes.get("dni_photo_back")?.status).toBe("invalid");
    expect(outcomes.get("justo_titulo")?.status).toBe("missing");
  });
});

describe("document state stored in raw_payload", () => {
  const stored = {
    download_url: "https://storage.example/estudio.pdf",
    field: "comparativa_pdf" as const,
    reason: null,
    size: 1024,
    status: "stored" as const,
  };
  const missing = {
    download_url: null,
    field: "dni_photo_back" as const,
    reason: null,
    size: null,
    status: "missing" as const,
  };

  test("keeps base64 out of the stored payload", () => {
    const attached = attachDocumentsToRawPayload(
      { ide: 1, comparativa_pdf: "AAAA", dni_photo_back: null },
      [stored, missing],
    ) as Record<string, unknown>;

    expect(attached.ide).toBe(1);
    expect(attached.comparativa_pdf).toBeNull();
    expect(attached.abarca_documents).toEqual([stored, missing]);
  });

  test("no guarda la factura: ya está adjunta a la comparativa", () => {
    const attached = attachDocumentsToRawPayload(
      { ide: 1, factura: "JVBERi0xLjc=", empresa: "Acme" },
      [stored],
    ) as Record<string, unknown>;

    expect("factura" in attached).toBe(false);
    expect(attached.empresa).toBe("Acme");
  });

  test("sustituye por su tamaño cualquier campo que pese como un fichero", () => {
    const gordo = "A".repeat(70 * 1024);

    const attached = attachDocumentsToRawPayload(
      { ide: 1, contrato_firmado: gordo, observaciones: "corta" },
      [stored],
    ) as Record<string, unknown>;

    expect(attached.contrato_firmado).toBe(`[omitido: ${gordo.length} bytes]`);
    expect(attached.observaciones).toBe("corta");
    expect(JSON.stringify(attached)).not.toContain(gordo);
  });

  test("reads the state back", () => {
    const rawPayload = JSON.stringify(
      attachDocumentsToRawPayload({ ide: 1 }, [stored, missing]),
    );

    expect(parseAbarcaDocuments(rawPayload)).toEqual([stored, missing]);
  });

  test.each([
    ["malformed json", "{not json"],
    ["a payload without documents", JSON.stringify({ ide: 1 })],
    ["documents of the wrong shape", JSON.stringify({ abarca_documents: [1] })],
  ])("returns no documents for %s", (_name, rawPayload) => {
    expect(parseAbarcaDocuments(rawPayload)).toEqual([]);
  });

  test("merges a late document over the recorded gap", () => {
    const rawPayload = JSON.stringify(
      attachDocumentsToRawPayload({ ide: 1, apolo_sips: null }, [
        stored,
        missing,
      ]),
    );

    const merged = mergeDocumentsIntoRawPayload(rawPayload, [
      { ...missing, status: "stored", size: 2048 },
    ]);

    const parsed = JSON.parse(merged) as Record<string, unknown>;
    // El resto del payload guardado sobrevive a la actualización.
    expect(parsed.ide).toBe(1);
    expect("apolo_sips" in parsed).toBe(true);
    expect(parseAbarcaDocuments(merged)).toEqual([
      stored,
      { ...missing, status: "stored", size: 2048 },
    ]);
  });
});
