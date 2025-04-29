import { createAccessControl } from "better-auth/plugins/access";

export const statement = {
  project: ["create", "share", "update", "delete"],
  user: [
    "create",
    "list",
    "set-role",
    "ban",
    "impersonate",
    "delete",
    "set-password",
  ],
} as const;

export const ac = createAccessControl(statement);

export const comercial = ac.newRole({
  project: ["update"],
  user: ["set-password"],
});

export const admin = ac.newRole({
  project: ["create", "update", "delete", "share"],
  user: [
    "create",
    "list",
    "set-role",
    "ban",
    "impersonate",
    "delete",
    "set-password",
  ],
});

export const backoffice = ac.newRole({
  project: ["create", "update", "delete", "share"],
  user: ["list", "set-role", "impersonate", "set-password"],
});
