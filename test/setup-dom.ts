import { GlobalRegistrator } from "@happy-dom/global-registrator";
import "@testing-library/jest-dom";
import { mock } from "bun:test";

GlobalRegistrator.register();

mock.module("better-auth/react", () => ({
  createAuthClient: () => ({
    useSession: () => ({ data: { session: null, user: null }, isPending: false }),
  }),
}));

mock.module("@/core/auth/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: { session: null, user: null }, isPending: false }),
  },
}));
