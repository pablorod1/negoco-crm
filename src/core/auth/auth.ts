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
} from "./auth-schema";
import { hashPassword, verifyPassword } from "./auth-utils";
import { organization, admin } from "better-auth/plugins";
import { sendPasswordResetEmail } from "../hooks/reset-pass-email";
import { admin as adminRole, comercial, backoffice, ac } from "./permissions";

export const getAuth = (req: NextRequest) => {
  const tursoClient = getTursoClient(req);
  const db = drizzle(tursoClient);

  const host = req.headers.get("host");
  const origin = req.headers.get("origin");

  if (!host) {
    throw new Error("No host found in request headers");
  }

  const resetLink = host.includes("localhost")
    ? `http://${host}/reset-pass`
    : `https://${host}/reset-pass`;

  return betterAuth({
    secrets: [
      { version: 1, secret: process.env.BETTER_AUTH_SECRET_V1 },
      { version: 2, secret: process.env.BETTER_AUTH_SECRET_V2 },
    ],
    baseURL: origin as string,
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
      expiresIn: 24 * 60 * 60, // 24 hours (24 * 60 * 60 seconds)
    },
    plugins: [
      organization({
        membershipLimit: 20000,
      }),
      admin({
        ac,
        roles: {
          admin: adminRole,
          "1": backoffice,
          "2": comercial,
        },
      }),
    ],
    advanced: {
      useSecureCookies: process.env.NODE_ENV === "production",
    },
  });
};
