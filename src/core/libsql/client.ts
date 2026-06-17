import { createClient } from "@libsql/client";
import { NextRequest } from "next/server";

export const getTursoClient = (req: NextRequest) => {
  // Obtener el host desde la cabecera "host"
  const host = req.headers.get("host");
  if (!host) {
    throw new Error("No host found in request headers");
  }

  // Extraer el subdominio (client1, client2, etc.)
  const subdomain = host.split(".")[0];

  // Construir el nombre de la variable de entorno
  const tursoUrlEnv =
    subdomain.includes("localhost")
      ? "NEXT_TURSO_DB_URL_TEST"
      : `NEXT_TURSO_DB_URL_${subdomain.toUpperCase()}`;
  const tursoAuthTokenEnv =
    subdomain.includes("localhost")
      ? "NEXT_TURSO_DB_AUTH_TOKEN_TEST"
      : `NEXT_TURSO_DB_AUTH_TOKEN_${subdomain.toUpperCase()}`;

  // Obtener las variables de entorno dinámicas
  const tursoUrl = process.env[tursoUrlEnv];
  const tursoAuthToken = process.env[tursoAuthTokenEnv];

  if (!tursoUrl || !tursoAuthToken) {
    throw new Error(`Missing Turso configuration for subdomain: ${subdomain}`);
  }

  // Crear el cliente de Turso
  return createClient({
    url: tursoUrl,
    authToken: tursoAuthToken,
  });
};

export const getTursoClientByTenant = (tenant: string) => {
  const tursoUrl = process.env[`NEXT_TURSO_DB_URL_${tenant.toUpperCase()}`];
  const tursoAuth =
    process.env[`NEXT_TURSO_DB_AUTH_TOKEN_${tenant.toUpperCase()}`];

  if (!tursoUrl || !tursoAuth) {
    throw new Error(`Missing Turso configuration for tenant: ${tenant}`);
  }

  return createClient({ url: tursoUrl, authToken: tursoAuth });
};

export const getTursoControlClient = () => {
  const tursoUrl =
    process.env.NEXT_TURSO_CONTROL_DB_URL || process.env.TURSO_CONTROL_DB_URL;
  const tursoAuth =
    process.env.NEXT_TURSO_CONTROL_DB_AUTH_TOKEN ||
    process.env.TURSO_CONTROL_DB_AUTH_TOKEN;

  if (!tursoUrl || !tursoAuth) {
    throw new Error("Missing Turso control database configuration");
  }

  return createClient({ url: tursoUrl, authToken: tursoAuth });
};
