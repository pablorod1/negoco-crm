import type { Client } from "@libsql/client";
import { NextRequest, NextResponse } from "next/server";
import { canUseNegocoStudies } from "@/comparador/access";
import { getEffectivePermissions } from "@/core/access-control/server";
import { validateUserSession } from "@/core/auth/session-utils";
import { getTursoClient } from "@/core/libsql/client";
import { getTenantModules } from "@/core/modules/server";
import { getTenantInfoFromRequest } from "@/crm-settings/utils";

export interface NegocoStudiesContext {
  user: { id: string; role: string; email: string | null };
  tenantSlug: string;
  client: Client;
}

type GuardResult =
  | { ok: true; context: NegocoStudiesContext }
  | { ok: false; response: NextResponse };

function deny(status: 401 | 403, error: string): GuardResult {
  return { ok: false, response: NextResponse.json({ error }, { status }) };
}

/**
 * Guarda común de las rutas de `/api/v2/comparador`. Aplica la misma regla
 * que el botón, pero con datos del servidor: nunca se fía del cliente.
 */
export async function requireNegocoStudiesAccess(
  request: NextRequest,
): Promise<GuardResult> {
  const session = await validateUserSession(request);
  if (!session.success || !session.user) {
    return deny(401, "Unauthorized");
  }

  const tenantSlug = getTenantInfoFromRequest(request).tenant_slug;
  const modules = await getTenantModules(tenantSlug);
  if (!modules.negoco_studies) {
    return deny(403, "Comparador no contratado");
  }

  const client = getTursoClient(request);
  const userResponse = await client.execute({
    sql: "SELECT role, super_id FROM user WHERE id = ? LIMIT 1",
    args: [session.user.id],
  });
  const userRow = userResponse.rows[0];
  if (!userRow) return deny(403, "Forbidden");

  const role = String(userRow.role);
  const permissions = await getEffectivePermissions(client, {
    id: session.user.id,
    role,
  });

  const allowed = canUseNegocoStudies({
    modules,
    role,
    isSubcomercial: role === "2" && Boolean(userRow.super_id),
    permissions,
  });
  if (!allowed) return deny(403, "Forbidden");

  return {
    ok: true,
    context: {
      user: { id: session.user.id, role, email: session.user.email ?? null },
      tenantSlug,
      client,
    },
  };
}
