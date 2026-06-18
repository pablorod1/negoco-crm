import { createHmac, timingSafeEqual } from "crypto";

export interface ImaginaSignatureVerificationInput {
  payload: unknown;
  headers: Headers | Record<string, string | null | undefined>;
  publicUrl: string;
  seedKey: string;
  nowMs?: number;
  toleranceSeconds?: number;
}

export interface ImaginaSignatureVerificationResult {
  valid: boolean;
  reason?: string;
  payloadForSignature: unknown;
  timestamp?: string;
}

type CallbackSignatureBody = {
  version?: string;
  algorithm?: string;
  signature?: string;
  timestamp?: string | number;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;

export const stripCallbackSignature = (payload: unknown): unknown => {
  if (Array.isArray(payload)) {
    return payload.map(stripCallbackSignature);
  }

  if (!isPlainObject(payload)) {
    return payload;
  }

  const clone: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (key === "_callback_signature") continue;
    clone[key] = stripCallbackSignature(value);
  }
  return clone;
};

export const canonicalizeJson = (value: unknown): string => {
  if (value === null) return "null";
  if (typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(canonicalizeJson).join(",")}]`;
  }
  if (isPlainObject(value)) {
    const entries = Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));

    return `{${entries
      .map(
        ([key, entryValue]) =>
          `${JSON.stringify(key)}:${canonicalizeJson(entryValue)}`,
      )
      .join(",")}}`;
  }

  return JSON.stringify(value);
};

const getHeader = (
  headers: ImaginaSignatureVerificationInput["headers"],
  name: string,
): string | undefined => {
  if (headers instanceof Headers) {
    return headers.get(name) ?? undefined;
  }

  const direct = headers[name];
  if (typeof direct === "string") return direct;
  const lowerName = name.toLowerCase();
  const match = Object.entries(headers).find(
    ([key]) => key.toLowerCase() === lowerName,
  );

  return typeof match?.[1] === "string" ? match[1] : undefined;
};

const getBodySignature = (payload: unknown): CallbackSignatureBody | null => {
  if (!isPlainObject(payload)) return null;
  const bodySignature = payload._callback_signature;
  return isPlainObject(bodySignature)
    ? (bodySignature as CallbackSignatureBody)
    : null;
};

const removeVersionPrefix = (signature: string): string =>
  signature.startsWith("v1=") ? signature.slice(3) : signature;

const toBase64Url = (buffer: Buffer): string =>
  buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const timingSafeStringEqual = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
};

export const signImaginaPayload = (
  seedKey: string,
  timestamp: string,
  publicUrl: string,
  payload: unknown,
): string => {
  const canonicalPayload = canonicalizeJson(stripCallbackSignature(payload));
  const message = `${timestamp}.${publicUrl}.${canonicalPayload}`;
  const digest = createHmac("sha256", seedKey).update(message).digest();
  return toBase64Url(digest);
};

export const verifyImaginaSignature = ({
  payload,
  headers,
  publicUrl,
  seedKey,
  nowMs = Date.now(),
  toleranceSeconds = 300,
}: ImaginaSignatureVerificationInput): ImaginaSignatureVerificationResult => {
  const bodySignature = getBodySignature(payload);
  const headerAlgorithm = getHeader(headers, "X-Signature-Algorithm");
  const bodyAlgorithm = bodySignature?.algorithm;

  if (
    (headerAlgorithm && headerAlgorithm !== "HS256") ||
    (bodyAlgorithm && bodyAlgorithm !== "HS256")
  ) {
    return {
      valid: false,
      reason: "Unsupported signature algorithm",
      payloadForSignature: stripCallbackSignature(payload),
    };
  }

  const headerSignature = getHeader(headers, "X-Signature");
  const rawSignature =
    headerSignature ||
    (bodySignature?.signature
      ? `${bodySignature.version || "v1"}=${bodySignature.signature}`
      : undefined);
  const headerTimestamp = getHeader(headers, "X-Signature-Timestamp");
  const rawTimestamp =
    headerTimestamp ||
    (bodySignature?.timestamp === undefined
      ? undefined
      : String(bodySignature.timestamp));

  if (!rawSignature || !rawTimestamp) {
    return {
      valid: false,
      reason: "Missing signature or timestamp",
      payloadForSignature: stripCallbackSignature(payload),
    };
  }

  if (headerSignature && bodySignature?.signature) {
    const bodyRawSignature = `${bodySignature.version || "v1"}=${
      bodySignature.signature
    }`;
    if (removeVersionPrefix(headerSignature) !== removeVersionPrefix(bodyRawSignature)) {
      return {
        valid: false,
        reason: "Header and body signatures differ",
        payloadForSignature: stripCallbackSignature(payload),
      };
    }
  }

  if (
    headerTimestamp &&
    bodySignature?.timestamp !== undefined &&
    headerTimestamp !== String(bodySignature.timestamp)
  ) {
    return {
      valid: false,
      reason: "Header and body timestamps differ",
      payloadForSignature: stripCallbackSignature(payload),
    };
  }

  const timestampSeconds = Number(rawTimestamp);
  if (!Number.isFinite(timestampSeconds)) {
    return {
      valid: false,
      reason: "Invalid signature timestamp",
      payloadForSignature: stripCallbackSignature(payload),
      timestamp: rawTimestamp,
    };
  }

  const nowSeconds = Math.floor(nowMs / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > toleranceSeconds) {
    return {
      valid: false,
      reason: "Signature timestamp outside tolerance",
      payloadForSignature: stripCallbackSignature(payload),
      timestamp: rawTimestamp,
    };
  }

  const expected = signImaginaPayload(seedKey, rawTimestamp, publicUrl, payload);
  const actual = removeVersionPrefix(rawSignature);

  return {
    valid: timingSafeStringEqual(expected, actual),
    reason: timingSafeStringEqual(expected, actual)
      ? undefined
      : "Invalid signature",
    payloadForSignature: stripCallbackSignature(payload),
    timestamp: rawTimestamp,
  };
};
