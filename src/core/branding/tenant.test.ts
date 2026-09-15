import { describe, expect, test } from "vitest";
import { getTenantFromHost, getTursoEnvNames } from "./tenant";

describe("getTenantFromHost", () => {
  test.each([
    ["beenergy.negococloud.es", "beenergy"],
    ["cliente.localhost:3000", "cliente"],
    ["localhost:3000", "localhost"],
    ["https://demo.negococloud.es/path", "demo"],
  ])("parses %s as %s", (host, tenant) => {
    expect(getTenantFromHost(host)).toBe(tenant);
  });
});

describe("getTursoEnvNames", () => {
  test("uses TEST database for plain localhost", () => {
    expect(getTursoEnvNames("localhost")).toEqual({
      url: "NEXT_TURSO_DB_URL_TEST",
      authToken: "NEXT_TURSO_DB_AUTH_TOKEN_TEST",
    });
  });

  test("normalizes tenant names for env suffixes", () => {
    expect(getTursoEnvNames("new-client")).toEqual({
      url: "NEXT_TURSO_DB_URL_NEW_CLIENT",
      authToken: "NEXT_TURSO_DB_AUTH_TOKEN_NEW_CLIENT",
    });
  });
});
