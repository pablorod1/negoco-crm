"use client";

import React from "react";
import { Search } from "lucide-react";
import type {
  ImaginaIntegrationStatus,
  ImaginaRate,
} from "@/comercializadoras/types";
import { Button } from "@/core/components/ui/button";
import { Checkbox } from "@/core/components/ui/checkbox";
import { Label } from "@/core/components/ui/label";
import { showCustomToast } from "@/core/components/CustomToast";
import { ContractDB } from "@/tramites/types";
import { InputComponent, SelectComponent } from "../InputComponent";
import ImaginaRateSelector from "./ImaginaRateSelector";

const TIPO_VIA_CNMC = [
  "Calle",
  "Avenida",
  "Plaza",
  "Paseo",
  "Camino",
  "Carretera",
  "Ronda",
  "Travesía",
  "Urbanización",
  "Polígono",
];

const SIGNATURE_CHANNELS = [
  { label: "SMS", value: "sms" },
  { label: "Email", value: "email" },
  { label: "Email OTP", value: "email_otp" },
];

interface CartoCiudadCandidate {
  id: string;
  label: string;
  tipo_via_cnmc: string;
  calle: string;
  numero_finca: string;
  postal_code: string;
  city: string;
  province: string;
}

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
  const [addressQuery, setAddressQuery] = React.useState("");
  const [addressLoading, setAddressLoading] = React.useState(false);
  const [candidates, setCandidates] = React.useState<CartoCiudadCandidate[]>(
    [],
  );

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

  const searchAddress = async () => {
    const query = addressQuery.trim() || formData.address.trim();
    if (query.length < 3) return;

    setAddressLoading(true);
    try {
      const params = new URLSearchParams({
        q: query,
        limit: "6",
      });
      if (formData.postal_code) params.set("postal_code", formData.postal_code);
      if (formData.province) params.set("province", formData.province);
      if (formData.city) params.set("city", formData.city);

      const response = await fetch(
        `/api/v2/addresses/cartociudad/search?${params}`,
      );
      const result = (await response.json()) as {
        success?: boolean;
        data?: CartoCiudadCandidate[];
        error?: string;
      };
      if (!result.success) {
        throw new Error(result.error || "No se ha podido buscar dirección");
      }
      setCandidates(result.data || []);
    } catch (error) {
      showCustomToast({
        title: "Error CartoCiudad",
        message: error instanceof Error ? error.message : String(error),
        icon: Search,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
    } finally {
      setAddressLoading(false);
    }
  };

  const applyCandidate = (candidate: CartoCiudadCandidate) => {
    setFormData((prev) => ({
      ...prev,
      address: candidate.label || prev.address,
      tipo_via_cnmc: candidate.tipo_via_cnmc || prev.tipo_via_cnmc,
      calle: candidate.calle || prev.calle,
      numero_finca: candidate.numero_finca || prev.numero_finca,
      postal_code: candidate.postal_code || prev.postal_code,
      city: candidate.city || prev.city,
      province: candidate.province || prev.province,
    }));
    setCandidates([]);
    setAddressQuery(candidate.label);
  };

  const rateStatusMessage = rateError
    ? rateError
    : ratesError
      ? `No se han podido cargar las tarifas de Imagina. ${ratesError}`
      : ratesLoading
        ? "Cargando tarifas de Imagina…"
        : "Comprobando la configuración de tarifas de Imagina…";

  return (
    <div className="space-y-4 rounded-md border border-primary-100 bg-primary-50/40 p-4">
      <div className="grid gap-4 md:grid-cols-2">
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
            className={`flex min-h-16 items-center rounded-xl border px-3 py-2 text-sm ${
              ratesError || rateError
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-primary-100 bg-white text-muted-foreground"
            }`}
          >
            {rateStatusMessage}
          </div>
        ) : null}
        <SelectComponent
          name="signature_channel"
          label="Canal firma"
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
      </div>

      <div className="space-y-2">
        <Label>Buscar dirección</Label>
        <div className="flex gap-2">
          <input
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={addressQuery}
            onChange={(event) => setAddressQuery(event.target.value)}
            placeholder={formData.address || "Dirección de suministro"}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={searchAddress}
            disabled={addressLoading}
            aria-label="Buscar dirección"
          >
            <Search className="h-4 w-4" />
          </Button>
        </div>
        {candidates.length > 0 && (
          <div className="rounded-md border bg-white">
            {candidates.map((candidate) => (
              <button
                type="button"
                key={candidate.id}
                className="block w-full border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-primary-50"
                onClick={() => applyCandidate(candidate)}
              >
                <span className="font-medium">{candidate.label}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {[candidate.postal_code, candidate.city, candidate.province]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <SelectComponent
          name="tipo_via_cnmc"
          label="Tipo vía CNMC"
          items={TIPO_VIA_CNMC}
          onChange={(value) => updateField("tipo_via_cnmc", value)}
          selectedKey={formData.tipo_via_cnmc || ""}
        />
        <InputComponent
          name="calle"
          label="Calle"
          onChange={handleStructuredFieldChange}
          value={formData.calle || ""}
          type="text"
        />
        <InputComponent
          name="numero_finca"
          label="Número"
          onChange={handleStructuredFieldChange}
          value={formData.numero_finca || ""}
          type="text"
        />
        <InputComponent
          name="aclarador_finca"
          label="Aclarador"
          onChange={handleStructuredFieldChange}
          value={formData.aclarador_finca || ""}
          type="text"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <InputComponent
          name="tipo_autoconsumo_cnmc"
          label="Autoconsumo CNMC"
          onChange={handleStructuredFieldChange}
          value={formData.tipo_autoconsumo_cnmc || ""}
          type="text"
        />
        <label className="flex items-center gap-2 pt-8 text-sm">
          <Checkbox
            checked={boolValue(formData.mismo_titular, true)}
            onCheckedChange={(checked) =>
              updateField("mismo_titular", Boolean(checked))
            }
          />
          Mismo titular
        </label>
        <label className="flex items-center gap-2 pt-8 text-sm">
          <Checkbox
            checked={boolValue(formData.misma_potencia, true)}
            onCheckedChange={(checked) =>
              updateField("misma_potencia", Boolean(checked))
            }
          />
          Misma potencia
        </label>
      </div>
    </div>
  );
}
