import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/libsql";
import { tursoClient } from "../libsql/client";
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
import { getOrganizationId } from "../libsql/data/colaboradores/getUsers";

// Drizzle solo para autenticación con Better Auth
const db = drizzle(tursoClient);

export const auth = betterAuth({
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
  plugins: [organization(), admin()],
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const organizationId = await getOrganizationId(session.userId);
          return {
            data: {
              ...session,
              activeOrganizationId: organizationId,
            },
          };
        },
      },
    },
  },
});
