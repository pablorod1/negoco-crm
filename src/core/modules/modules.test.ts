import type { Client } from "@libsql/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { clearTenantModulesCache, getTenantModules } from "./server";

type FakeClient = Pick<Client, "execute"> & {
  execute: ReturnType<typeof vi.fn>;
};

function clientReturning(rows: Record<string, unknown>[]): FakeClient {
  return { execute: vi.fn(async () => ({ rows })) } as unknown as FakeClient;
}

afterEach(() => {
  clearTenantModulesCache();
  vi.restoreAllMocks();
});

describe("getTenantModules", () => {
  test("reads the enabled modules of the tenant", async () => {
    const client = clientReturning([
      { module_key: "negoco_studies", enabled: 1 },
    ]);

    await expect(getTenantModules("test", { client })).resolves.toEqual({
      negoco_studies: true,
    });
    expect(client.execute).toHaveBeenCalledWith({
      sql: expect.stringContaining("FROM tenant_modules"),
      args: ["test"],
    });
  });

  test("treats missing and disabled rows as disabled and ignores unknown keys", async () => {
    await expect(
      getTenantModules("beenergy", { client: clientReturning([]) }),
    ).resolves.toEqual({ negoco_studies: false });

    await expect(
      getTenantModules("other", {
        client: clientReturning([
          { module_key: "negoco_studies", enabled: 0 },
          { module_key: "unknown_module", enabled: 1 },
        ]),
      }),
    ).resolves.toEqual({ negoco_studies: false });
  });

  test("caches per tenant for one minute", async () => {
    const client = clientReturning([
      { module_key: "negoco_studies", enabled: 1 },
    ]);

    await getTenantModules("test", { client, now: 0 });
    await getTenantModules("test", { client, now: 59_999 });
    expect(client.execute).toHaveBeenCalledTimes(1);

    await getTenantModules("test", { client, now: 60_000 });
    expect(client.execute).toHaveBeenCalledTimes(2);
  });

  test("fails closed when the control database is unavailable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const client = {
      execute: vi.fn(async () => {
        throw new Error("no such table: tenant_modules");
      }),
    } as unknown as FakeClient;

    await expect(getTenantModules("test", { client })).resolves.toEqual({
      negoco_studies: false,
    });

    // Un fallo no se cachea: la siguiente petición vuelve a intentarlo.
    await getTenantModules("test", { client });
    expect(client.execute).toHaveBeenCalledTimes(2);
  });
});
