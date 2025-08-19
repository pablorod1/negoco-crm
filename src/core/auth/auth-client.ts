import { createAuthClient } from "better-auth/react";
import { adminClient, organizationClient } from "better-auth/client/plugins";
import { ac, admin, backoffice, comercial } from "./permissions";

export const authClient = createAuthClient({
  plugins: [
    adminClient({
      ac,
      roles: {
        admin,
        "1": backoffice,
        "2": comercial,
      },
    }),
    organizationClient(),
  ],
});
