"use client";
import { CircleX, Zap } from "lucide-react";
import { PLAIN_CONTRACT_TYPES, PLANS, POTS } from "@/tramites/constants";
import { ContractDB } from "@/tramites/types";
import { createEmptyContractDB } from "@/tramites/utils/tramite.factories";
import { validateField } from "@/tramites/utils/validation/create-contract/field-validation";
import { validateContract } from "@/tramites/utils/validation/create-contract/form-validation";
import {
  ContractError,
  createEmptyContractError,
} from "@/core/validation/validation.types";
import React from "react";
import ButtonGroupComponent from "@/core/components/ButtonGroupComponent";
import { InputComponent, SelectComponent } from "../InputComponent";
import { showCustomToast } from "@/core/components/CustomToast";
import { Textarea } from "@/core/components/ui/textarea";
import { Label } from "@/core/components/ui/label";
import { ScrollArea } from "@/core/components/ui/scroll-area";
import { useActiveEnergySuppliers } from "@/comercializadoras/hooks/useActiveEnergySuppliers";
import { Skeleton } from "@/core/components/ui/skeleton";
import { ComparativaVM } from "@/comparativas/types";
import { useUser } from "@/core/contexts/UserContext";
import {
  isValidApoloSipsCups,
  sanitizeCups,
  summarizeElectricityConsumption,
  useApoloSips,
} from "@/integrations/apolo-sips";

type ApoloConsumptionFeedback = {
  type: "success" | "warning";
  message: string;
};

type ApoloConsumptionState = {
  cups: string | null;
  requestId: number;
  status: "idle" | "pending" | "success" | "warning";
  feedback: ApoloConsumptionFeedback | null;
};

interface Props {
  onCreateContract: (contract: ContractDB) => void;
  tramite_id: string;
  onCancel: () => void;
  contract?: ContractDB | null;
  loading?: boolean;
  lastStep?: boolean;
  comparativa?: ComparativaVM;
}

const createIdleApoloConsumptionState = (
  requestId = 0,
): ApoloConsumptionState => ({
  cups: null,
  requestId,
  status: "idle",
  feedback: null,
});

const createPendingApoloConsumptionState = (
  cups: string,
  requestId: number,
): ApoloConsumptionState => ({
  cups,
  requestId,
  status: "pending",
  feedback: null,
});

const createInitialApoloConsumptionState = (
  contract: ContractDB | null | undefined,
  comparativa: ComparativaVM | undefined,
): ApoloConsumptionState => {
  const cups = sanitizeCups(
    contract?.CUPS || comparativa?.abarca_estudio?.cups || "",
  );

  return isValidApoloSipsCups(cups)
    ? createPendingApoloConsumptionState(cups, 1)
    : createIdleApoloConsumptionState();
};

export default function ContractForm({
  onCreateContract,
  tramite_id,
  onCancel,
  contract,
  loading,
  lastStep,
  comparativa,
}: Props) {
  const { userData } = useUser();
  const { fetchConsumptions } = useApoloSips();
  const [errors, setErrors] = React.useState<ContractError>(
    createEmptyContractError,
  );
  const [formData, setFormData] = React.useState<ContractDB>(
    () => (contract ? contract : createEmptyContractDB(comparativa)),
  );
  const [apoloConsumption, setApoloConsumption] =
    React.useState<ApoloConsumptionState>(() =>
      createInitialApoloConsumptionState(contract, comparativa),
    );
  const isConsumptionReadOnly = userData?.role === "2";
  const apoloConsumptionStatus = apoloConsumption.status;
  const apoloConsumptionCups = apoloConsumption.cups;
  const apoloConsumptionRequestId = apoloConsumption.requestId;
  const isCalculatingConsumption = apoloConsumptionStatus === "pending";
  const apoloConsumptionFeedback = apoloConsumption.feedback;

  // Load active energy suppliers
  const { activeSuppliers, loading: suppliersLoading } =
    useActiveEnergySuppliers();

  // Convert suppliers to dropdown format
  const supplierOptions = React.useMemo(
    () =>
      activeSuppliers.map((supplier) => ({
        label: supplier.name,
        value: supplier.id,
      })),
    [activeSuppliers],
  );

  const autoMatchedOldCompanyId = React.useMemo(() => {
    if (formData.old_company || activeSuppliers.length === 0) return "";
    const empresaCliente = comparativa?.abarca_estudio?.empresa_cliente;
    if (!empresaCliente) return "";

    const name = empresaCliente.split(" - ")[0].trim().toLowerCase();
    if (!name) return "";

    const match = activeSuppliers.find((s) =>
      s.name.toLowerCase().includes(name),
    );
    return match?.id ?? "";
  }, [activeSuppliers, comparativa, formData.old_company]);
  const selectedOldCompanyId = formData.old_company || autoMatchedOldCompanyId;

  const queueApoloConsumptionLookup = (rawCups: string) => {
    const cups = sanitizeCups(rawCups);

    setApoloConsumption((prev) => {
      if (!isValidApoloSipsCups(cups)) {
        return prev.status === "idle" && prev.cups === null
          ? prev
          : createIdleApoloConsumptionState(prev.requestId + 1);
      }

      return prev.cups === cups && prev.status !== "idle"
        ? prev
        : createPendingApoloConsumptionState(cups, prev.requestId + 1);
    });
  };

  React.useEffect(() => {
    if (apoloConsumptionStatus !== "pending" || !apoloConsumptionCups) {
      return;
    }

    const cups = apoloConsumptionCups;
    const requestId = apoloConsumptionRequestId;
    let ignoreResult = false;

    const loadConsumption = async () => {
      try {
        if (ignoreResult) return;

        const data = await fetchConsumptions({
          cups,
          tipoSuministro: "ELECTRICIDAD",
        });

        if (!ignoreResult) {
          if (
            !data ||
            data.tipoSuministro !== "ELECTRICIDAD" ||
            !data.consumos
          ) {
            setApoloConsumption((prev) => {
              if (prev.requestId !== requestId) return prev;
              return {
                cups,
                requestId,
                status: "warning",
                feedback: {
                  type: "warning",
                  message:
                    "No se pudo obtener consumo de SIPS. Puedes guardar el contrato igualmente.",
                },
              };
            });
            return;
          }

          const summary = summarizeElectricityConsumption(data.consumos.rows);

          if (summary.rows.length === 0) {
            setApoloConsumption((prev) => {
              if (prev.requestId !== requestId) return prev;
              return {
                cups,
                requestId,
                status: "warning",
                feedback: {
                  type: "warning",
                  message:
                    "SIPS no devolvio consumos para este CUPS. Puedes guardar el contrato igualmente.",
                },
              };
            });
            return;
          }

          setFormData((prev) => ({
            ...prev,
            CUPS: cups,
            consumption: summary.totalActiveEnergyKwh,
          }));
          setApoloConsumption((prev) => {
            if (prev.requestId !== requestId) return prev;
            return {
              cups,
              requestId,
              status: "success",
              feedback: {
                type: "success",
                message: "Consumo obtenido desde SIPS (ult. 12 meses).",
              },
            };
          });
        }
      } catch {
        if (!ignoreResult) {
          setApoloConsumption((prev) => {
            if (prev.requestId !== requestId) return prev;
            return {
              cups,
              requestId,
              status: "warning",
              feedback: {
                type: "warning",
                message:
                  "No se pudo obtener consumo. Puedes guardar el contrato igualmente.",
              },
            };
          });
        }
      }
    };

    void loadConsumption();

    return () => {
      ignoreResult = true;
    };
  }, [
    apoloConsumptionCups,
    apoloConsumptionRequestId,
    apoloConsumptionStatus,
    fetchConsumptions,
  ]);

  const handleFieldChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const name = e.target.name;

    setErrors((prev) => ({
      ...prev,
      [name]: validateField(value).errorMessage || "",
    }));

    // Handle numeric fields
    const numericFields = [
      "consumption",
      "pot1",
      "pot2",
      "pot3",
      "pot4",
      "pot5",
      "pot6",
    ];
    let processedValue: string | number = value;

    if (numericFields.includes(name)) {
      // Convert string to number, handle empty strings as 0
      processedValue = value === "" ? 0 : parseFloat(value) || 0;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: processedValue,
    }));

    if (name === "CUPS") {
      queueApoloConsumptionLookup(value);
    }
  };

  const handleTextAreaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const name = e.target.name;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAddContract = () => {
    const validation = validateContract({
      type: formData.type,
      postal_code: formData.postal_code,
      province: formData.province,
      city: formData.city,
      address: formData.address,
      CUPS: formData.CUPS,
      plan: formData.plan,
      new_company: formData.new_company,
    });

    if (!validation.succeeded) {
      showCustomToast({
        title: "Error",
        message: "Por favor, rellena todos los campos obligatorios",
        iconColor: "var(--danger-color)",
        iconSize: 24,
        icon: CircleX,
      });
      setErrors(validation.errors);
      return;
    }

    onCreateContract({
      ...formData,
      old_company: selectedOldCompanyId,
      tramite_id: tramite_id,
    });
  };

  const handleSelectChange = (value: string, name: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setErrors((prev) => ({
      ...prev,
      [name]: validateField(value).errorMessage || "",
    }));
  };

  return (
    <>
      <form>
        <ScrollArea className="w-full h-full max-h-[calc(100vh-400px)]">
          <div className="flex flex-col gap-y-4 w-full px-4">
            <div className="flex items-stretch gap-4 w-full">
              <SelectComponent
                name="type"
                label="Tipo de contrato"
                items={PLAIN_CONTRACT_TYPES}
                onChange={(value) => handleSelectChange(value, "type")}
                errors={errors.type}
                isRequired
                selectedKey={formData.type}
              />
              <SelectComponent
                name="plan"
                label="Tipo de tarifa"
                items={PLANS}
                onChange={(value) => handleSelectChange(value, "plan")}
                errors={errors.plan}
                isRequired
                selectedKey={formData.plan}
              />
            </div>
            <div className="flex items-stretch gap-4 w-full">
              <InputComponent
                name="province"
                label="Provincia"
                onChange={handleFieldChange}
                value={formData.province}
                errors={errors.province}
                type="text"
                isRequired
              />
              <InputComponent
                name="city"
                label="Población"
                onChange={handleFieldChange}
                value={formData.city}
                errors={errors.city}
                type="text"
                isRequired
              />
              <InputComponent
                name="postal_code"
                label="Código Postal"
                onChange={handleFieldChange}
                value={formData.postal_code}
                errors={errors.postal_code}
                type="text"
                isRequired
              />
            </div>
            <InputComponent
              name="address"
              label="Dirección"
              onChange={handleFieldChange}
              value={formData.address}
              errors={errors.address}
              type="text"
              isRequired
            />
            <div className="flex items-stretch gap-4 w-full">
              <InputComponent
                name="CUPS"
                label="CUPS"
                onChange={handleFieldChange}
                value={formData.CUPS}
                errors={errors.CUPS}
                type="text"
                isRequired
              />
              {suppliersLoading ? (
                <Skeleton className="h-10 w-full rounded-md" />
              ) : (
                <SelectComponent
                  name="old_company"
                  label="Compañía Antigua"
                  items={supplierOptions}
                  onChange={(value) => handleSelectChange(value, "old_company")}
                  selectedKey={selectedOldCompanyId}
                  textValue={
                    supplierOptions.find(
                      (s) => s.value === selectedOldCompanyId,
                    )?.label
                  }
                />
              )}
              {suppliersLoading ? (
                <Skeleton className="h-10 w-full rounded-md" />
              ) : (
                <SelectComponent
                  name="new_company"
                  label="Compañía Nueva"
                  items={supplierOptions}
                  onChange={(value) => handleSelectChange(value, "new_company")}
                  errors={errors.new_company}
                  isRequired
                  selectedKey={formData.new_company || ""}
                  textValue={
                    supplierOptions.find(
                      (s) => s.value === formData.new_company,
                    )?.label
                  }
                />
              )}
              <div className="w-full space-y-1.5">
                <InputComponent
                  name="consumption"
                  label="Consumo"
                  value={
                    typeof formData.consumption === "number"
                      ? formData.consumption.toString()
                      : formData.consumption || ""
                  }
                  onChange={handleFieldChange}
                  type="number"
                  readOnly={isConsumptionReadOnly}
                />
                {apoloConsumptionFeedback && (
                  <p
                    className={`ml-2 text-xs ${apoloConsumptionFeedback.type === "success"
                      ? "text-emerald-700"
                      : "text-amber-700"
                      }`}
                  >
                    {apoloConsumptionFeedback.message}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-stretch gap-4 w-full">
              {POTS.map((pot, index) => (
                <InputComponent
                  key={pot}
                  onChange={handleFieldChange}
                  name={`pot${index + 1}`}
                  label={pot}
                  type="number"
                  value={
                    formData[`pot${index + 1}` as keyof ContractDB] !==
                      undefined
                      ? (
                        formData[
                        `pot${index + 1}` as keyof ContractDB
                        ] as number
                      ).toString()
                      : "0"
                  }
                  startContent={<Zap size={16} stroke="#333" />}
                />
              ))}
            </div>
            <div className="space-y-1">
              <Label htmlFor="description" className="text-sm font-semibold">
                Descripción
              </Label>
              <Textarea
                id="description"
                name="description"
                onChange={handleTextAreaChange}
              />
            </div>
          </div>
        </ScrollArea>
      </form>
      <ButtonGroupComponent
        loading={loading}
        onSubmit={handleAddContract}
        onCancel={onCancel}
        lastStep={lastStep}
        submitDisabled={isCalculatingConsumption}
        submitLabel={
          isCalculatingConsumption ? "Calculando consumo..." : undefined
        }
      />
    </>
  );
}
