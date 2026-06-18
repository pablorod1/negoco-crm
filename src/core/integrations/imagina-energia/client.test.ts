import { describe, expect, test, vi } from "vitest";
import {
  ImaginaEnergiaClient,
  MissingImaginaChannelError,
} from "./client";
import type { ImaginaEnergiaConfig } from "./config";

const config: ImaginaEnergiaConfig = {
  environment: "pre",
  authBaseUrl: "https://auth.example.test",
  apiBaseUrl: "https://api.example.test",
  email: "user@example.test",
  password: "secret",
  callbackSeedKey: "seed",
  webhookPublicRootDomain: "negoco.test",
  requestTimeoutMs: 1000,
};

describe("ImaginaEnergiaClient", () => {
  test("requests a JWT for every functional API call", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/initiateauthcommand")) {
        return new Response(JSON.stringify({ token: "jwt", expires_in: 3600 }));
      }
      return new Response(JSON.stringify({ request_id: 1, ok: true }));
    });
    const client = new ImaginaEnergiaClient(config, fetchMock as typeof fetch);

    await client.request({
      method: "GET",
      path: "/tarifas",
      channelId: "tenant-channel",
    });
    await client.request({
      method: "GET",
      path: "/contratos",
      channelId: "tenant-channel",
    });

    const authCalls = fetchMock.mock.calls.filter(([input]) =>
      String(input).includes("/initiateauthcommand"),
    );
    expect(authCalls).toHaveLength(2);
  });

  test("sends Authorization and X-Canal headers on functional calls", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/initiateauthcommand")) {
        return new Response(JSON.stringify({ token: "jwt" }));
      }
      return new Response(JSON.stringify({ request_id: "req-1" }));
      },
    );
    const client = new ImaginaEnergiaClient(config, fetchMock as typeof fetch);

    await client.request({
      method: "GET",
      path: "/tarifas",
      channelId: "tenant-channel",
    });

    const functionalCall = fetchMock.mock.calls.find(([input]) =>
      String(input).includes("/tarifas"),
    );
    const headers = functionalCall?.[1]?.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer jwt");
    expect(headers.get("X-Canal")).toBe("tenant-channel");
  });

  test("rejects before network IO when X-Canal is missing", async () => {
    const fetchMock = vi.fn();
    const client = new ImaginaEnergiaClient(config, fetchMock as typeof fetch);

    await expect(
      client.request({ method: "GET", path: "/tarifas" }),
    ).rejects.toBeInstanceOf(MissingImaginaChannelError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
