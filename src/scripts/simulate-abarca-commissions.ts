import { getTursoClientByTenant } from "@/core/libsql/client";
import { getAbarcaCommissions } from "@/integrations/abarca/commissions/contract";
import { buildAbarcaPayload } from "@/integrations/abarca/commissions/payload";

const tenants = (process.env.ABARCA_COMISION_TENANTS ?? "")
  .split(",").map((tenant) => tenant.trim()).filter(Boolean);

const tenantUsers = await Promise.all(tenants.map(async (tenant) => {
  const db = getTursoClientByTenant(tenant);
  const users = await db.execute(`SELECT id, name, abarca_user_id FROM user
    WHERE role = '2' AND abarca_user_id IS NOT NULL ORDER BY name`);
  return { tenant, db, users: users.rows };
}));

const identities = new Map<number, string[]>();
for (const { tenant, users } of tenantUsers) for (const user of users) {
  const identity = Number(user.abarca_user_id);
  identities.set(identity, [...(identities.get(identity) ?? []), `${tenant}/${user.id}`]);
}
const collisions = [...identities].filter(([, owners]) => owners.length > 1);
if (collisions.length) {
  console.error(JSON.stringify({ identity_collisions: Object.fromEntries(collisions) }, null, 2));
  process.exitCode = 1;
}

for (const { tenant, db, users } of tenantUsers) {
  for (const user of users) {
    const userId = String(user.id);
    if ((identities.get(Number(user.abarca_user_id))?.length ?? 0) > 1) continue;
    const remote = await getAbarcaCommissions(Number(user.abarca_user_id));
    const [effective, mappings, managed] = await Promise.all([
      db.execute({ sql: `SELECT own.comercializadora_id, own.segment, own.commission_type, own.commission_value
        FROM user_company_commissions own WHERE own.user_id = ?
        UNION ALL SELECT fallback.comercializadora_id, fallback.segment, fallback.commission_type, fallback.commission_value
        FROM default_company_commissions fallback WHERE NOT EXISTS (
          SELECT 1 FROM user_company_commissions own WHERE own.user_id = ?
          AND own.comercializadora_id = fallback.comercializadora_id AND own.segment = fallback.segment)`, args: [userId, userId] }),
      db.execute("SELECT comercializadora_id, segment, abarca_name FROM abarca_commission_mappings"),
      db.execute({ sql: "SELECT abarca_name, segment, commission_type, desired_value FROM abarca_commission_managed_rules WHERE user_id = ? AND abarca_user_id = ?", args: [userId, Number(user.abarca_user_id)] }),
    ]);
    const result = buildAbarcaPayload(effective.rows, mappings.rows, managed.rows, remote.catalog);
    console.log(JSON.stringify({ tenant, user_id: userId, name: user.name,
      abarca_user_id: user.abarca_user_id, rules_to_send: result.rules,
      unresolved: result.unresolved }, null, 2));
  }
}
