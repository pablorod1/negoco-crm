import { describe, expect, test } from "vitest";
import { aliasHostSegment, hostTenantSegment } from "./tenant-host-alias";

const env = { TENANT_HOST_ALIASES: "test-comparador=test, api-comparador=api" };

describe("tenant host aliases", () => {
  test("without the variable nothing changes", () => {
    expect(hostTenantSegment("beenergy.negococloud.es", {})).toBe("beenergy");
    expect(hostTenantSegment("test-comparador.negococloud.es", {})).toBe("test-comparador");
  });

  test("a test environment serves an existing tenant and its webhooks", () => {
    expect(hostTenantSegment("test-comparador.negococloud.es", env)).toBe("test");
    expect(hostTenantSegment("api-comparador.negococloud.es", env)).toBe("api");
    expect(hostTenantSegment("beenergy.negococloud.es", env)).toBe("beenergy");
  });

  test("several pilots, even if the value is pasted with quotes, «;» or line breaks", () => {
    for (const value of [
      "test-comparador=test,api-comparador=api,beenergy-comparador=beenergy",
      '"test-comparador=test, beenergy-comparador=beenergy"',
      "test-comparador=test;\nbeenergy-comparador=beenergy",
    ]) {
      expect(hostTenantSegment("beenergy-comparador.negococloud.es", { TENANT_HOST_ALIASES: value })).toBe("beenergy");
      expect(hostTenantSegment("test-comparador.negococloud.es", { TENANT_HOST_ALIASES: value })).toBe("test");
    }
  });

  test("ignores ports and case", () => {
    expect(hostTenantSegment("Test-Comparador.negococloud.es:443", env)).toBe("test");
    expect(hostTenantSegment("localhost:3000", env)).toBe("localhost");
    expect(aliasHostSegment("TEST-COMPARADOR", env)).toBe("test");
  });
});
