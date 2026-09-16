import type { ComercializadoraVM } from "@/comercializadoras/types";
import type { ContractDB } from "@/tramites/types";
import { resolveSupplierSelection } from "@/tramites/utils/validation/create-contract/rate-validation";

// Los contratos guardan la comercializadora por id o por nombre según el
// tenant, así que hay que resolverla contra el catálogo antes de comparar.
export const findImaginaContract = (
  contracts: ContractDB[],
  suppliers: Pick<ComercializadoraVM, "id" | "name">[],
): ContractDB | undefined =>
  contracts.find(
    (contract) =>
      resolveSupplierSelection(contract.new_company || "", suppliers, false)
        .isImagina,
  );
