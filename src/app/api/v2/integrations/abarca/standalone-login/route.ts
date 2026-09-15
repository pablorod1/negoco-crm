import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasAiStudiesCapability } from "@/core/access-control/capabilities";
import { validateUserSession } from "@/core/auth/session-utils";
import { getTursoClient } from "@/core/libsql/client";

const LOGIN_TIMEOUT_MS = 10_000;
const MAX_LOGIN_RESPONSE_BYTES = 64 * 1024;

class OversizedComparatorResponseError extends Error {}

function isAllowedLoginUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      (url.port === "" || url.port === "443") &&
      (url.hostname === "abarcaia.com" ||
        url.hostname.endsWith(".abarcaia.com"))
    );
  } catch {
    return false;
  }
}

const LoginResponseSchema = z.object({
  login_url: z.string().min(1).refine(isAllowedLoginUrl),
});

async function readBoundedResponseText(response: Response): Promise<string> {
  const contentLengthHeader = response.headers.get("content-length");
  if (contentLengthHeader !== null) {
    const contentLength = Number(contentLengthHeader);
    if (
      !Number.isSafeInteger(contentLength) ||
      contentLength < 0 ||
      contentLength > MAX_LOGIN_RESPONSE_BYTES
    ) {
      throw new OversizedComparatorResponseError();
    }
  }

  if (!response.body) {
    throw new Error("Comparator response has no body");
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    totalBytes += value.byteLength;
    if (totalBytes > MAX_LOGIN_RESPONSE_BYTES) {
      await reader.cancel();
      throw new OversizedComparatorResponseError();
    }
    chunks.push(value);
  }

  return Buffer.concat(
    chunks.map((chunk) => Buffer.from(chunk)),
    totalBytes,
  ).toString("utf8");
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await validateUserSession(req);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const client = getTursoClient(req);
    if (!client) {
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }

    const activeOrganizationId =
      authResult.user.activeOrganizationId ?? null;
    const organizationResponse = await client.execute({
      sql: `SELECT
        o.id AS organization_id,
        LOWER(p.name) AS plan_name,
        o.abarca_user_id
      FROM member m
      LEFT JOIN organization o ON m.organization_id = o.id
      LEFT JOIN plans p ON o.plan = p.id
      WHERE m.user_id = ?
        AND (? IS NULL OR m.organization_id = ?)
      ORDER BY o.id
      LIMIT 2`,
      args: [
        authResult.user.id,
        activeOrganizationId,
        activeOrganizationId,
      ],
    });
    if (organizationResponse.rows.length !== 1) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const organization = organizationResponse.rows[0];
    if (
      !organization ||
      typeof organization.organization_id !== "string" ||
      !organization.organization_id.trim()
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const planName =
      typeof organization.plan_name === "string"
        ? organization.plan_name.trim().toLowerCase()
        : "";
    if (planName !== "comparador") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const integrationValue = organization.abarca_user_id;
    if (!hasAiStudiesCapability(integrationValue)) {
      return NextResponse.json(
        { error: "Integración de IA no configurada" },
        { status: 409 },
      );
    }
    const comparatorUserId = Number(integrationValue);

    const { ABARCA_API_KEY, ABARCA_TOKEN } = process.env;
    if (!ABARCA_API_KEY || !ABARCA_TOKEN) {
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LOGIN_TIMEOUT_MS);
    let rawText: string;

    try {
      const response = await fetch(
        "https://abarcaia.com/comparar/api/generate-login-token",
        {
          method: "POST",
          redirect: "manual",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            "x-api-key": ABARCA_API_KEY,
          },
          body: JSON.stringify({
            ide: 100,
            idcm: comparatorUserId,
            clave: ABARCA_TOKEN,
          }),
        },
      );

      if (
        (response.status >= 300 && response.status < 400) ||
        !response.ok
      ) {
        console.error(
          `[standalone-comparator-login] upstream HTTP ${response.status}`,
        );
        return NextResponse.json(
          { error: "No se pudo conectar con el comparador" },
          { status: 502 },
        );
      }

      rawText = await readBoundedResponseText(response);
    } catch (err) {
      if (err instanceof OversizedComparatorResponseError) {
        return NextResponse.json(
          { error: "Respuesta inválida del comparador" },
          { status: 502 },
        );
      }

      console.error("[standalone-comparator-login] upstream error", err);
      return NextResponse.json(
        { error: "No se pudo conectar con el comparador" },
        { status: 502 },
      );
    } finally {
      clearTimeout(timeout);
    }

    let data: unknown;
    try {
      data = JSON.parse(rawText);
    } catch {
      return NextResponse.json(
        { error: "Respuesta inválida del comparador" },
        { status: 502 },
      );
    }

    const validation = LoginResponseSchema.safeParse(data);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Respuesta inválida del comparador" },
        { status: 502 },
      );
    }

    return NextResponse.json({ loginUrl: validation.data.login_url });
  } catch (error) {
    console.error("[standalone-comparator-login] unexpected error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
