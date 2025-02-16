import { Client, createClient } from "@libsql/client/http";

export function tursoClient(): Client {
  const url = process.env.NEXT_PUBLIC_TURSO_DB_URL;
  if (!url) {
    throw new Error("TURSO_DB_URL is not defined");
  }

  const authToken = process.env.NEXT_PUBLIC_TURSO_DB_AUTH_TOKEN;
  if (!authToken) {
    throw new Error("TURSO_DB_AUTH_TOKEN is not defined");
  }

  return createClient({
    url,
    authToken,
  });
}
