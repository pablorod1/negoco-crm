import { beforeEach, describe, expect, test, vi } from "vitest";
import type { NextRequest } from "next/server";

type MockSession = {
  success: boolean;
  user?: { id: string; role: string; email: string; name: string };
};

const settingsResponse = {
  providers: [],
  processing_auto_activation: {
    enabled: false,
    delay_minutes: 0,
    delay_value: 0,
    delay_unit: "minutes",
  },
};

const mocks = vi.hoisted(() => ({
  getTursoClient: vi.fn(),
  getCrmSettings: vi.fn(),
  updateCrmSettings: vi.fn(),
  cancelPendingProcessingJobs: vi.fn(),
  sessionResult: {
    success: true,
    user: { id: "admin1", role: "admin", email: "a@b.com", name: "Admin" },
  } as MockSession,
}));

vi.mock("@/core/libsql/client", () => ({
  getTursoClient: mocks.getTursoClient,
}));
vi.mock("/src/core/libsql/client.ts", () => ({
  getTursoClient: mocks.getTursoClient,
}));
vi.mock("@/core/auth/session-utils", () => ({
  validateUserSession: () => mocks.sessionResult,
}));
vi.mock("/src/core/auth/session-utils.ts", () => ({
  validateUserSession: () => mocks.sessionResult,
}));
vi.mock("@/crm-settings/server", () => ({
  getCrmSettings: mocks.getCrmSettings,
  updateCrmSettings: mocks.updateCrmSettings,
}));
vi.mock("@/crm-settings/processing-jobs", () => ({
  cancelPendingProcessingJobs: mocks.cancelPendingProcessingJobs,
}));

const route = await import("./route");

const createRequest = (body?: unknown) =>
  ({
    json: async () => body,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "host" ? "tenant.example.com" : null,
    },
  }) as unknown as NextRequest;

beforeEach(() => {
  mocks.getTursoClient.mockReset();
  mocks.getTursoClient.mockReturnValue({ execute: vi.fn() });
  mocks.getCrmSettings.mockReset();
  mocks.getCrmSettings.mockResolvedValue(settingsResponse);
  mocks.updateCrmSettings.mockReset();
  mocks.updateCrmSettings.mockResolvedValue(settingsResponse);
  mocks.cancelPendingProcessingJobs.mockReset();
  mocks.sessionResult = {
    success: true,
    user: { id: "admin1", role: "admin", email: "a@b.com", name: "Admin" },
  };
});

describe("GET /crm-settings", () => {
  test("requires authentication", async () => {
    mocks.sessionResult = { success: false };

    const res = await route.GET(createRequest());

    expect(res.status).toBe(401);
    expect(mocks.getCrmSettings).not.toHaveBeenCalled();
  });

  test("allows authenticated users to read settings", async () => {
    mocks.sessionResult = {
      success: true,
      user: { id: "user1", role: "2", email: "u@b.com", name: "User" },
    };

    const res = await route.GET(createRequest());

    expect(res.status).toBe(200);
    expect(mocks.getCrmSettings).toHaveBeenCalledTimes(1);
  });
});

describe("PATCH /crm-settings", () => {
  test("rejects non-admin users", async () => {
    mocks.sessionResult = {
      success: true,
      user: { id: "user1", role: "1", email: "u@b.com", name: "User" },
    };

    const res = await route.PATCH(
      createRequest({
        providers: ["Endesa"],
      }),
    );

    expect(res.status).toBe(403);
    expect(mocks.updateCrmSettings).not.toHaveBeenCalled();
  });

  test("cancels pending tenant jobs when automation is disabled", async () => {
    const res = await route.PATCH(
      createRequest({
        processing_auto_activation: {
          enabled: false,
          delay_value: 1,
          delay_unit: "days",
        },
      }),
    );

    expect(res.status).toBe(200);
    expect(mocks.updateCrmSettings).toHaveBeenCalledTimes(1);
    expect(mocks.cancelPendingProcessingJobs).toHaveBeenCalledWith({
      tenantSlug: "tenant",
    });
  });
});
