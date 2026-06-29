export function getHostName(host: string | null | undefined): string {
  if (!host) return "localhost";

  const withoutProtocol = host.replace(/^https?:\/\//, "");
  return withoutProtocol.split("/")[0]?.split(":")[0]?.toLowerCase() || "localhost";
}

export function getTenantFromHost(host: string | null | undefined): string {
  const hostname = getHostName(host);

  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    return "localhost";
  }

  if (hostname.endsWith(".localhost")) {
    return hostname.split(".")[0] || "localhost";
  }

  return hostname.split(".")[0] || "default";
}

export function getTursoEnvNames(tenant: string) {
  const isLocalTenant = tenant === "localhost";
  const suffix = isLocalTenant ? "TEST" : tenant.toUpperCase().replace(/-/g, "_");

  return {
    url: `NEXT_TURSO_DB_URL_${suffix}`,
    authToken: `NEXT_TURSO_DB_AUTH_TOKEN_${suffix}`,
  };
}
