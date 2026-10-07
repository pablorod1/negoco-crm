/**
 * Alias de subdominio para entornos de prueba. El tenant sale del primer
 * segmento del host (`beenergy.negococloud.es` → beenergy); un entorno aparte
 * puede servir un tenant existente desde otro subdominio:
 *
 *   TENANT_HOST_ALIASES="test-comparador=test"
 *
 * `test-comparador.negococloud.es` usa entonces la base, los módulos y la
 * marca de test. Sin la variable no cambia nada.
 */
export function aliasHostSegment(
  segment: string,
  env: Record<string, string | undefined> = process.env,
): string {
  const aliases = env.TENANT_HOST_ALIASES;
  if (!aliases) return segment;
  for (const pair of aliases.split(",")) {
    const [from, to] = pair.split("=").map((value) => value.trim().toLowerCase());
    if (from && to && from === segment.toLowerCase()) return to;
  }
  return segment;
}

/** Primer segmento del host, sin puerto, en minúsculas y con el alias aplicado. */
export function hostTenantSegment(
  host: string,
  env: Record<string, string | undefined> = process.env,
): string {
  const segment = host.split(".")[0]?.replace(/:\d+$/, "").toLowerCase() ?? "";
  return aliasHostSegment(segment, env);
}
