import { Client, createClient } from "@libsql/client";

export const tursoClient: Client = createClient({
  url: process.env.NEXT_PUBLIC_TURSO_DB_URL as string,
  authToken: process.env.NEXT_PUBLIC_TURSO_DB_AUTH_TOKEN as string,
});
