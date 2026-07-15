const IMAGINA_SUPPLIER_NAME = "imagina energia";

const decodeRouteValue = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const normalizeSupplierName = (value: string): string =>
  decodeRouteValue(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

export const isImaginaSupplierName = (
  value: string | string[] | null | undefined,
): boolean => {
  const supplierName = Array.isArray(value) ? value[0] : value;

  return Boolean(
    supplierName &&
      normalizeSupplierName(supplierName) === IMAGINA_SUPPLIER_NAME,
  );
};
