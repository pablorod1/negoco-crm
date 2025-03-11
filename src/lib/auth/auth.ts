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

export const getAuth = (req: NextRequest) => {
  const tursoClient = getTursoClient(req); // Cliente Turso dinámico según subdominio
  const db = drizzle(tursoClient);

  return betterAuth({
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
      "http://localhost:3000/api/auth",
      "http://localhost:3000",
      "http://beenergy.localhost:3000",
      "https://negococloud.es/api/auth",
      "https://negococloud.es",
      "https://beenergy.negococloud.es",
    ],
  });
};
