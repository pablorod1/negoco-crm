export interface CartoCiudadCandidate {
  id: string;
  type: string;
  label: string;
  address: string;
  tipo_via_cnmc: string;
  calle: string;
  numero_finca: string;
  postal_code: string;
  city: string;
  province: string;
}

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const text = (value: unknown) => (value == null ? "" : String(value).trim());

export function normalizeCandidate(
  candidate: Record<string, unknown>,
): CartoCiudadCandidate {
  const type = text(candidate.type);
  const tipo = text(candidate.tip_via);
  const number =
    type === "portal" && !candidate.noNumber
      ? text(candidate.portalNumber)
      : "";
  const extension = number ? text(candidate.extension) : "";
  let street = text(candidate.address);
  // Candidates append locality to the display label, outside the street name.
  for (const locality of [
    candidate.muni,
    candidate.poblacion,
    candidate.province,
  ]) {
    if (locality)
      street = street.replace(
        new RegExp(`,\\s*${escapeRegExp(text(locality))}$`, "i"),
        "",
      );
  }
  if (tipo)
    street = street.replace(new RegExp(`^${escapeRegExp(tipo)}\\s+`, "i"), "");
  if (number)
    street = street.replace(
      new RegExp(
        `[,\\s]+${escapeRegExp(number)}\\s*${escapeRegExp(extension)}$`,
        "i",
      ),
      "",
    );
  const numero = [number, extension].filter(Boolean).join(" ");
  const address = [tipo, street.trim(), numero].filter(Boolean).join(" ");
  return {
    id: text(candidate.id),
    type,
    label: text(candidate.address),
    address,
    tipo_via_cnmc: tipo
      ? tipo[0].toLocaleUpperCase("es") + tipo.slice(1).toLocaleLowerCase("es")
      : "",
    calle: street.trim(),
    numero_finca: numero,
    postal_code: text(candidate.postalCode),
    city: text(candidate.poblacion) || text(candidate.muni),
    province: text(candidate.province),
  };
}
