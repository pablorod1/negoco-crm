"use client";

import React from "react";
import type {
  ImaginaIntegrationStatus,
  ImaginaRate,
} from "@/comercializadoras/types";
import { ContractDB } from "@/tramites/types";
import { InputComponent, SelectComponent } from "../InputComponent";
import ImaginaRateSelector from "./ImaginaRateSelector";

const YES_NO_OPTIONS = [
  { label: "Sí", value: "yes" },
  { label: "No", value: "no" },
];

const SIGNATURE_CHANNELS = [
  { label: "SMS", value: "sms" },
  { label: "Email", value: "email" },
  { label: "Email OTP", value: "email_otp" },
];

interface Props {
  formData: ContractDB;
  setFormData: React.Dispatch<React.SetStateAction<ContractDB>>;
  integration: ImaginaIntegrationStatus | null;
  rates: ImaginaRate[];
  unavailableSelectedRate: ImaginaRate | null;
  ratesLoading: boolean;
  ratesError: string | null;
  historicalRateId?: string;
  rateError?: string;
  onRateChange: (rateId: string) => void;
}

const boolValue = (value: unknown, fallback: boolean) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  return fallback;
};

export default function ImaginaContractFields({
  formData,
  setFormData,
  integration,
  rates,
  unavailableSelectedRate,
  ratesLoading,
  ratesError,
  historicalRateId,
  rateError,
  onRateChange,
}: Props) {
  const updateField = (
    name: keyof ContractDB,
    value: string | number | boolean | null,
  ) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleStructuredFieldChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    updateField(event.target.name as keyof ContractDB, event.target.value);
  };

  const rateStatusMessage = rateError
    ? rateError
    : ratesError
      ? `No se han podido cargar las tarifas de Imagina. ${ratesError}`
      : ratesLoading
        ? "Cargando tarifas de Imagina…"
        : "Comprobando la configuración de tarifas de Imagina…";

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        {integration?.configured ? (
          <ImaginaRateSelector
            rates={rates}
            selectedRateId={formData.rate_id}
            historicalRateId={historicalRateId}
            unavailableSelectedRate={unavailableSelectedRate}
            onChange={onRateChange}
            error={rateError}
          />
        ) : integration === null ? (
          <div
            role={ratesError || rateError ? "alert" : "status"}
            className={`flex min-h-16 items-center rounded-xl border px-3 py-2 text-sm ${ratesError || rateError
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-primary-100 bg-white text-muted-foreground"
              }`}
          >
            {rateStatusMessage}
          </div>
        ) : null}
        <SelectComponent
          name="signature_channel"
          label="Canal de firma"
          items={SIGNATURE_CHANNELS}
          onChange={(value) => updateField("signature_channel", value)}
          selectedKey={formData.signature_channel || "sms"}
          textValue={
            SIGNATURE_CHANNELS.find(
              (option) =>
                option.value === (formData.signature_channel || "sms"),
            )?.label
          }
        />
        <SelectComponent
          name="mismo_titular"
          label="¿Se mantiene el titular?"
          items={YES_NO_OPTIONS}
          selectedKey={boolValue(formData.mismo_titular, true) ? "yes" : "no"}
          textValue={boolValue(formData.mismo_titular, true) ? "Sí" : "No"}
          onChange={(value) => updateField("mismo_titular", value === "yes")}
        />
        <SelectComponent
          name="misma_potencia"
          label="¿Se mantienen las potencias contratadas?"
          items={YES_NO_OPTIONS}
          selectedKey={boolValue(formData.misma_potencia, true) ? "yes" : "no"}
          textValue={boolValue(formData.misma_potencia, true) ? "Sí" : "No"}
          onChange={(value) => updateField("misma_potencia", value === "yes")}
        />
      </div>

      <div className="space-y-2">
        <InputComponent
          name="tipo_autoconsumo_cnmc"
          label="Código de autoconsumo (opcional)"
          placeholder="Código CNMC, si corresponde"
          onChange={handleStructuredFieldChange}
          value={formData.tipo_autoconsumo_cnmc || ""}
          type="text"
        />
        <p className="text-xs text-muted-foreground">
          Completa este código solo si el suministro tiene autoconsumo.
        </p>
      </div>
    </>
  );
}
