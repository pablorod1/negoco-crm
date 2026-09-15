import type { ComparativaChange } from "@/comparativas/utils/comparativaChangesHelpers";

const salesFields = new Set(["comision_sales_person_fijo", "comision_sales_person_indexado"]);
const financial = /comisi[oó]n|commission|agency|agencia|oferta_euros|offer_euros|raw_payload|crm_id|base_percentage|amount|precio|euros/i;
const scalarAmount = (value: string | null) => value === null || /^-?\d+(?:\.\d+)?$/.test(value);

function hasUnsafeCompoundValue(value: string | null, field: string | null): boolean {
  if (!value || !/^[\[{]/.test(value.trimStart())) return false;
  if (field !== "plan") return true;
  try {
    const plan: unknown = JSON.parse(value);
    return !Array.isArray(plan) || !plan.every((item) => item === "fijo" || item === "indexado");
  } catch {
    return true;
  }
}

export function salesVisibleHistory(changes: ComparativaChange[]): ComparativaChange[] {
  return changes.flatMap((change) => {
    if (salesFields.has(change.field_name ?? "")) {
      if (!scalarAmount(change.old_value) || !scalarAmount(change.new_value)) return [];
      // Historical descriptions can contain compound financial snapshots; reconstruct only sales text.
      return [{ ...change, description: "Comisión comercial actualizada" }];
    }
    if (change.change_type === "commission_update" ||
        [change.field_name, change.description, change.old_value, change.new_value].some((value) => financial.test(value ?? ""))) return [];
    if ([change.old_value, change.new_value].some((value) => hasUnsafeCompoundValue(value, change.field_name))) return [];
    if (hasUnsafeCompoundValue(change.description, null)) return [];
    return [change];
  });
}
