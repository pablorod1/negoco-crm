import assert from "node:assert/strict";
import { test } from "node:test";
import {
  decodeDocumentBase64,
  sniffDocumentContentType,
} from "../src/documents.js";
import { buildStagingPrefix, stageDocuments } from "../src/staging.js";

const png = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
]);
const pdf = Buffer.from("%PDF-1.7 body", "latin1");

function recordingUploader() {
  const uploaded = [];
  return {
    uploaded,
    async upload(path, bytes, contentType) {
      uploaded.push({ bytes, contentType, path });
      return { url: `https://storage.example/${path}` };
    },
  };
}

test("replaces every document with a reference to Storage", async () => {
  const { upload, uploaded } = recordingUploader();

  const { slim, staged } = await stageDocuments(
    {
      ide: 1,
      empresa: "Acme",
      comparativa_pdf: pdf.toString("base64"),
      dni_photo_front: png.toString("base64"),
    },
    { prefix: "abarca-inbox/tenant/comparison-1/delivery", upload },
  );

  assert.equal(slim.ide, 1);
  assert.equal(slim.empresa, "Acme");
  assert.equal(uploaded.length, 2);
  assert.equal(staged.length, 2);
  // Nada de base64 viaja al CRM: es lo que disparaba el 413 de Vercel.
  assert.ok(!JSON.stringify(slim).includes(pdf.toString("base64")));
  assert.deepEqual(slim.comparativa_pdf, {
    path: "abarca-inbox/tenant/comparison-1/delivery/comparativa_pdf.pdf",
    url: "https://storage.example/abarca-inbox/tenant/comparison-1/delivery/comparativa_pdf.pdf",
    bytes: pdf.length,
    content_type: "application/pdf",
    sha256: staged[0].sha256,
  });
  assert.equal(slim.dni_photo_front.content_type, "image/png");
});

test("stages an undecodable document instead of dropping it", async () => {
  const { upload, uploaded } = recordingUploader();

  const { slim } = await stageDocuments(
    { dni_photo_back: "not base64 ***" },
    { prefix: "inbox/x", upload },
  );

  assert.equal(uploaded.length, 1);
  assert.equal(uploaded[0].path, "inbox/x/dni_photo_back.bin");
  assert.equal(slim.dni_photo_back.content_type, "application/octet-stream");
});

test("leaves absent documents untouched", async () => {
  const { upload, uploaded } = recordingUploader();

  const { slim } = await stageDocuments(
    { dni_photo_back: null, justo_titulo: "" },
    { prefix: "inbox/x", upload },
  );

  assert.equal(uploaded.length, 0);
  assert.equal(slim.dni_photo_back, null);
  assert.equal(slim.justo_titulo, "");
});

test("keeps tenant and comparison ids safe as storage segments", () => {
  const prefix = buildStagingPrefix("tenant/../evil", "comp 1", "inbox");

  assert.match(prefix, /^inbox\/tenant_evil\/comp_1\/[0-9a-f-]{36}$/);
});

test("decodes what the CRM validation used to reject", () => {
  assert.deepEqual(
    decodeDocumentBase64(`data:image/png;base64,${png.toString("base64")}`),
    png,
  );
  assert.equal(sniffDocumentContentType(png), "image/png");
});
