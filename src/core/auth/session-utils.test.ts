import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

vi.mock("@/core/auth/auth", () => ({
  getAuth: () => ({
    api: {
      getSession: mocks.getSession,
    },
  }),
}));

const { validateUserSession } = await import("./session-utils");

const request = new NextRequest("https://tenant.example.com/api/example");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("validateUserSession", () => {
  test.each([null, undefined, ""])(
    "fails closed when the authenticated user role is %s",
    async (role) => {
      mocks.getSession.mockResolvedValue({
        user: {
          id: "user-1",
          role,
          email: "user@example.com",
          name: "User",
        },
        session: {
          activeOrganizationId: "organization-1",
        },
      });

      await expect(validateUserSession(request)).resolves.toEqual({
        success: false,
        error: "Unauthorized: No valid session found",
      });
    },
  );

  test("returns the explicit role and active organization", async () => {
    mocks.getSession.mockResolvedValue({
      user: {
        id: "user-1",
        role: "2",
        email: "user@example.com",
        name: "User",
      },
      session: {
        activeOrganizationId: "organization-1",
      },
    });

    await expect(validateUserSession(request)).resolves.toEqual({
      success: true,
      user: {
        id: "user-1",
        role: "2",
        email: "user@example.com",
        name: "User",
        activeOrganizationId: "organization-1",
      },
    });
  });
});
