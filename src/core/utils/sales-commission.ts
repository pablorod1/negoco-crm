import { ComercializadoraVM } from "@/comercializadoras/types";
import { UserCompanyCommission } from "@/core/types";

function normalizeSupplierName(name: string) {
  return name.trim().toLowerCase();
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

interface SalesCommissionInput {
  baseCommission: number;
  supplierId?: string | null;
  supplierName?: string | null;
  commissions: UserCompanyCommission[];
  suppliers?: ComercializadoraVM[];
}

export function calculateSalesPersonCommission({
  baseCommission,
  supplierId,
  supplierName,
  commissions,
  suppliers = [],
}: SalesCommissionInput) {
  if (!Number.isFinite(baseCommission) || baseCommission === 0) return null;

  const supplierIdFromName = suppliers.find(
    (supplier) =>
      supplierName &&
      normalizeSupplierName(supplier.name) === normalizeSupplierName(supplierName),
  )?.id;

  const resolvedSupplierId = supplierId || supplierIdFromName;

  if (!resolvedSupplierId) return null;

  const rule = commissions.find(
    (commission) =>
      commission.comercializadora_id === resolvedSupplierId ||
      commission.comercializadora_id === supplierIdFromName,
  );
  if (!rule) return null;

  if (rule.commission_type === "fixed") {
    const sign = baseCommission < 0 ? -1 : 1;
    return roundCurrency(Math.abs(rule.commission_value) * sign);
  }

  return roundCurrency((baseCommission * rule.commission_value) / 100);
}
