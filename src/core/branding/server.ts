import { createClient } from "@libsql/client";
import type { NextRequest } from "next/server";
import { DEFAULT_BRANDING } from "./defaults";
import { resolveBrandingFromOrganization } from "./metadata";
import { getTenantFromHost, getTursoEnvNames } from "./tenant";
import type { ResolvedBranding } from "./types";

type HeadersLike = {
  get(name: string): string | null;
};

type RequestLike = NextRequest | Request | HeadersLike;

function isHeadersLike(input: RequestLike): input is HeadersLike {
  return "get" in input && typeof input.get === "function";
}

function getHost(input: RequestLike): string | null {
  if (isHeadersLike(input)) {
    return input.get("host");
  }

  return input.headers.get("host");
}

export async function getBrandingForHost(host: string | null): Promise<ResolvedBranding> {
  const tenant = getTenantFromHost(host);
  const envNames = getTursoEnvNames(tenant);
  const url = process.env[envNames.url];
  const authToken = process.env[envNames.authToken];

  if (!url || !authToken) {
    return {
      ...DEFAULT_BRANDING,
      tenant,
    };
  }

  try {
    const client = createClient({ url, authToken });
    const result = await client.execute({
      sql: `SELECT
        o.name,
        o.logo,
        o.metadata,
        LOWER(p.name) as plan_name
      FROM organization o
      LEFT JOIN plans p ON o.plan = p.id
      LIMIT 1`,
      args: [],
    });

    const row = result.rows[0];
    if (!row) {
      return {
        ...DEFAULT_BRANDING,
        tenant,
      };
    }

    return resolveBrandingFromOrganization({
      tenant,
      name: row.name ? String(row.name) : null,
      logo: row.logo ? String(row.logo) : null,
      plan: row.plan_name ? String(row.plan_name) : null,
      metadata: row.metadata ? String(row.metadata) : null,
    });
  } catch (error) {
    console.error("Error resolving tenant branding:", error);
    return {
      ...DEFAULT_BRANDING,
      tenant,
    };
  }
}

export async function getBrandingForRequest(
  input: RequestLike,
): Promise<ResolvedBranding> {
  return getBrandingForHost(getHost(input));
}
