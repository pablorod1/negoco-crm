import { describe, expect, test } from "vitest";
import {
  readImaginaEnergiaConfig,
  resolveImaginaRuntimeEnvironment,
} from "./config";

const baseEnv = {
  IMAGINA_EMAIL: "user@example.test",
  IMAGINA_PASSWORD: "secret",
  IMAGINA_CALLBACK_SEED_KEY: "seed",
  IMAGINA_WEBHOOK_PUBLIC_ROOT_DOMAIN: "negococloud.es",
};

describe("Imagina environment config", () => {
  test("development requires PRE URLs", () => {
    expect(() =>
      readImaginaEnergiaConfig({
        ...baseEnv,
        NODE_ENV: "development",
      }),
    ).toThrow("IMAGINA_AUTH_BASE_URL_PRE");
  });

  test("development reads PRE URLs from environment", () => {
    const config = readImaginaEnergiaConfig({
      ...baseEnv,
      NODE_ENV: "development",
      IMAGINA_ENVIRONMENT: "production",
      IMAGINA_AUTH_BASE_URL_PROD: "https://prod-auth.example.test",
      IMAGINA_API_BASE_URL_PROD: "https://prod-api.example.test",
      IMAGINA_AUTH_BASE_URL_PRE: "https://pre-auth.example.test/",
      IMAGINA_API_BASE_URL_PRE: "https://pre-api.example.test/",
    });

    expect(config.environment).toBe("pre");
    expect(config.authBaseUrl).toBe("https://pre-auth.example.test");
    expect(config.apiBaseUrl).toBe("https://pre-api.example.test");
  });

  test("manual environment variables do not override runtime selection", () => {
    expect(
      resolveImaginaRuntimeEnvironment({
        NODE_ENV: "development",
        IMAGINA_ENVIRONMENT: "production",
      }),
    ).toBe("pre");
  });

  test("production requires PROD URLs", () => {
    expect(() =>
      readImaginaEnergiaConfig({
        ...baseEnv,
        NODE_ENV: "production",
      }),
    ).toThrow("IMAGINA_AUTH_BASE_URL_PROD");
  });

  test("production reads PROD URLs from environment", () => {
    const config = readImaginaEnergiaConfig({
      ...baseEnv,
      NODE_ENV: "production",
      IMAGINA_AUTH_BASE_URL_PRE: "https://pre-auth.example.test",
      IMAGINA_API_BASE_URL_PRE: "https://pre-api.example.test",
      IMAGINA_AUTH_BASE_URL_PROD: "https://prod-auth.example.test/",
      IMAGINA_API_BASE_URL_PROD: "https://prod-api.example.test/",
    });

    expect(config.environment).toBe("production");
    expect(config.authBaseUrl).toBe("https://prod-auth.example.test");
    expect(config.apiBaseUrl).toBe("https://prod-api.example.test");
  });

  test("VERCEL_ENV production selects production", () => {
    expect(
      resolveImaginaRuntimeEnvironment({
        NODE_ENV: "production",
        VERCEL_ENV: "preview",
      }),
    ).toBe("pre");
    expect(
      resolveImaginaRuntimeEnvironment({
        NODE_ENV: "production",
        VERCEL_ENV: "production",
      }),
    ).toBe("production");
  });
});
