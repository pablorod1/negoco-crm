import { timingSafeEqual } from "node:crypto";
import express from "express";
import { initializeApp } from "firebase/app";
import {
  getDownloadURL,
  getStorage,
  ref,
  uploadBytes,
} from "firebase/storage";
import { buildStagingPrefix, stageDocuments } from "./staging.js";

const MAX_BODY = "32mb";
// Vercel corta el cuerpo en ~4,5MB en el edge. El payload ya sin documentos
// debe quedar muy por debajo; si no, algo más viene inflado y conviene verlo
// aquí con un error legible en vez de un 413 opaco del edge.
const MAX_FORWARDED_BYTES = 3 * 1024 * 1024;
const FORWARD_TIMEOUT_MS = 5 * 60 * 1000;

const requiredEnv = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
};

const ABARCA_API_KEY = requiredEnv("ABARCA_API_KEY");
const CRM_WEBHOOK_URL = requiredEnv("CRM_WEBHOOK_URL");
const STAGING_ROOT = process.env.STAGING_ROOT || "abarca-inbox";

const firebaseApp = initializeApp({
  apiKey: process.env.FIREBASE_API_KEY,
  appId: process.env.FIREBASE_APP_ID,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: requiredEnv("FIREBASE_STORAGE_BUCKET"),
});
const storage = getStorage(firebaseApp);

function matchesApiKey(candidate) {
  if (typeof candidate !== "string") return false;
  const expected = Buffer.from(ABARCA_API_KEY);
  const received = Buffer.from(candidate);
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}

async function uploadToStaging(path, bytes, contentType) {
  const objectRef = ref(storage, path);
  await uploadBytes(objectRef, bytes, { contentType });
  return { url: await getDownloadURL(objectRef) };
}

const app = express();
app.disable("x-powered-by");

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post(
  "*",
  express.json({ limit: MAX_BODY, type: () => true }),
  async (req, res) => {
    if (!matchesApiKey(req.get("x-api-key"))) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const tenant = req.get("x-tenant");
    const comparativaId = req.get("x-comparativa-id");
    if (!tenant || !comparativaId) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid request" });
    }
    if (!req.body || typeof req.body !== "object") {
      return res
        .status(400)
        .json({ success: false, error: "Invalid request" });
    }

    const prefix = buildStagingPrefix(tenant, comparativaId, STAGING_ROOT);
    let slim;
    let staged;
    try {
      ({ slim, staged } = await stageDocuments(req.body, {
        prefix,
        upload: uploadToStaging,
      }));
    } catch (error) {
      // Sin subir los documentos no se reenvía nada: es preferible que Abarca
      // reintente a cerrar una comparativa sin sus ficheros.
      console.error("[abarca-ingest] staging failed", {
        comparativaId,
        error: error instanceof Error ? error.message : error,
        tenant,
      });
      return res
        .status(503)
        .json({ success: false, error: "Storage unavailable" });
    }

    const forwarded = JSON.stringify(slim);
    const forwardedBytes = Buffer.byteLength(forwarded);
    console.log("[abarca-ingest] staged", {
      comparativaId,
      documents: staged.map(({ bytes, content_type, field }) => ({
        bytes,
        content_type,
        field,
      })),
      forwardedBytes,
      tenant,
    });

    if (forwardedBytes > MAX_FORWARDED_BYTES) {
      console.error("[abarca-ingest] payload too large after staging", {
        comparativaId,
        forwardedBytes,
      });
      return res
        .status(413)
        .json({ success: false, error: "Payload too large" });
    }

    try {
      const response = await fetch(CRM_WEBHOOK_URL, {
        body: forwarded,
        headers: {
          "content-type": "application/json",
          "x-api-key": req.get("x-api-key"),
          "x-comparativa-id": comparativaId,
          "x-tenant": tenant,
        },
        method: "POST",
        signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS),
      });

      const text = await response.text();
      console.log("[abarca-ingest] forwarded", {
        comparativaId,
        status: response.status,
      });
      return res
        .status(response.status)
        .type(response.headers.get("content-type") ?? "application/json")
        .send(text);
    } catch (error) {
      console.error("[abarca-ingest] forwarding failed", {
        comparativaId,
        error: error instanceof Error ? error.message : error,
      });
      return res
        .status(503)
        .json({ success: false, error: "CRM unavailable" });
    }
  },
);

// Sin esto, un cuerpo demasiado grande o un JSON roto devuelven el HTML de
// error de Express: exactamente el tipo de fallo opaco que Abarca no puede
// diagnosticar. Mejor un JSON con la causa y el tamaño recibido.
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);

  const status = Number(error?.status ?? error?.statusCode ?? 500);
  const received = req.get("content-length") ?? "unknown";
  console.error("[abarca-ingest] request rejected", {
    comparativaId: req.get("x-comparativa-id"),
    contentLength: received,
    message: error instanceof Error ? error.message : error,
    status,
  });

  if (error?.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      error: `Payload too large (${received} bytes, max ${MAX_BODY})`,
    });
  }
  return res
    .status(status >= 400 && status < 500 ? status : 500)
    .json({ success: false, error: "Invalid request" });
});

const port = Number(process.env.PORT) || 8080;
app.listen(port, () => {
  console.log(`[abarca-ingest] listening on ${port}`);
});
