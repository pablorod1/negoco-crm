import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/libsql";
import { NextRequest } from "next/server";
import { getTursoClient } from "../libsql/client";
import {
  account,
  session,
  user,
  verification,
  organization as organizationSchema,
  member,
  invitation,
} from "../../../auth-schema";
import { hashPassword, verifyPassword } from "./auth-utils";
import { organization, admin } from "better-auth/plugins";
import { sendPasswordResetEmail } from "../hooks/reset-pass-email";

export const getAuth = (req: NextRequest) => {
  const tursoClient = getTursoClient(req);
  const db = drizzle(tursoClient);

  const host = req.headers.get("host");
  const origin = req.headers.get("origin");

  if (!host) {
    throw new Error("No host found in request headers");
  }

  if (!origin) {
    throw new Error("No origin found in request headers");
  }
  const resetLink = host.includes("localhost")
    ? `http://${host}/reset-pass`
    : `https://${host}/reset-pass`;

  return betterAuth({
    baseURL: origin,
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: {
        user,
        account,
        session,
        verification,
        organization: organizationSchema,
        member,
        invitation,
      },
    }),
    emailAndPassword: {
      enabled: true,
      password: {
        hash: hashPassword,
        verify: async ({ password, hash }) => {
          return await verifyPassword(password, hash);
        },
      },
      requireEmailVerification: false,
      sendResetPassword: async ({ user, token }) => {
        await sendPasswordResetEmail({
          email: user.email,
          resetLink: `${resetLink}?token=${token}`,
        });
      },
      resetPasswordTokenExpiresIn: 24 * 60 * 60,
    },
    user: {
      changeEmail: {
        enabled: true,
      },
      deleteUser: {
        enabled: true,
      },
    },
    session: {
      expiresIn: 24 * 60 * 60,
    },
    plugins: [organization(), admin()],
    trustedOrigins: [
      origin,
      "https://test.negococloud.es",
      "https://beenergy.negococloud.es",
      "http://localhost:3000",
      "http://beenergy.localhost:3000",
      "http://test.localhost:3000",
    ],
  });
};
