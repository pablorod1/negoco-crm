"use client";

import type { ImaginaRate } from "@/comercializadoras/types";
import { Label } from "@/core/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/core/components/ui/select";
import { rateMatchesId } from "@/tramites/utils/validation/create-contract/rate-validation";

interface Props {
  rates: ImaginaRate[];
  selectedRateId?: string | null;
  historicalRateId?: string;
  unavailableSelectedRate?: ImaginaRate | null;
  onChange: (rateId: string) => void;
  error?: string;
}

interface RateOption {
  rate: ImaginaRate;
  value: string;
  unavailable: boolean;
}

const getRateName = (rate: ImaginaRate): string =>
  rate.alias_externo?.trim() ||
  rate.name?.trim() ||
  rate.external_rate_id?.trim() ||
  rate.id;

const createHistoricalFallback = (rateId: string): ImaginaRate => ({
  id: rateId,
  name: rateId,
  external_rate_id: rateId,
  alias_externo: null,
  codigo_atr: null,
  descripcion: null,
  synced_at: null,
});

const RateDetails = ({ option }: { option: RateOption }) => (
  <div className="flex min-w-0 flex-col gap-0.5 py-0.5 text-left normal-case">
    <div className="flex min-w-0 items-center gap-2">
      <span className="truncate font-semibold">{getRateName(option.rate)}</span>
      {option.unavailable ? (
        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
          No disponible
        </span>
      ) : null}
    </div>
    <span className="text-xs text-muted-foreground group-focus:text-inherit group-hover:text-inherit">
      {option.rate.codigo_atr?.trim() || "Sin código ATR"}
    </span>
    <span className="max-w-[32rem] truncate text-xs text-muted-foreground group-focus:text-inherit group-hover:text-inherit">
      {option.rate.descripcion?.trim() || "Sin descripción"}
    </span>
  </div>
);

export default function ImaginaRateSelector({
  rates,
  selectedRateId,
  historicalRateId,
  unavailableSelectedRate,
  onChange,
  error,
}: Props) {
  const normalizedSelectedRateId = selectedRateId?.trim() || "";
  const selectedAvailableRate = rates.find((rate) =>
    rateMatchesId(rate, normalizedSelectedRateId),
  );
  const isHistoricalSelection = Boolean(
    normalizedSelectedRateId &&
      historicalRateId &&
      normalizedSelectedRateId === historicalRateId,
  );
  const matchingUnavailableRate =
    isHistoricalSelection &&
    unavailableSelectedRate &&
    rateMatchesId(unavailableSelectedRate, normalizedSelectedRateId)
      ? unavailableSelectedRate
      : null;
  const historicalRate =
    !selectedAvailableRate && isHistoricalSelection
      ? matchingUnavailableRate ||
        createHistoricalFallback(normalizedSelectedRateId)
      : null;
  const historicalOption = historicalRate
    ? {
        rate: historicalRate,
        value: normalizedSelectedRateId,
        unavailable: true,
      }
    : null;
  const selectedOption: RateOption | null = selectedAvailableRate
    ? {
        rate: selectedAvailableRate,
        value: selectedAvailableRate.id,
        unavailable: false,
      }
    : historicalOption;

  return (
    <div className="flex w-full flex-col gap-2">
      <Label htmlFor="rate_id">
        Tarifa Imagina <span className="text-red-500">*</span>
      </Label>
      <Select
        name="rate_id"
        value={selectedOption?.value || ""}
        onValueChange={onChange}
        required
      >
        <SelectTrigger
          id="rate_id"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "rate_id-error" : undefined}
          className="h-auto min-h-10 rounded-xl py-2"
        >
          <SelectValue placeholder="Seleccione una tarifa">
            {selectedOption ? (
              <span className="flex min-w-0 items-center gap-2 text-left normal-case">
                <span className="truncate font-medium">
                  {getRateName(selectedOption.rate)}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {selectedOption.rate.codigo_atr?.trim() || "Sin código ATR"}
                </span>
                {selectedOption.unavailable ? (
                  <span className="shrink-0 text-xs font-medium text-amber-700">
                    No disponible
                  </span>
                ) : null}
              </span>
            ) : null}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          {rates.map((rate) => {
            const option: RateOption = {
              rate,
              value: rate.id,
              unavailable: false,
            };

            return (
              <SelectItem
                key={rate.id}
                value={rate.id}
                textValue={[
                  getRateName(rate),
                  rate.codigo_atr,
                  rate.descripcion,
                ]
                  .filter(Boolean)
                  .join(" ")}
                className="group rounded-xl pr-9"
              >
                <RateDetails option={option} />
              </SelectItem>
            );
          })}
          {historicalOption ? (
            <SelectItem
              key={`historical-${historicalOption.value}`}
              value={historicalOption.value}
              textValue={[
                getRateName(historicalOption.rate),
                historicalOption.rate.codigo_atr,
                historicalOption.rate.descripcion,
                "No disponible",
              ]
                .filter(Boolean)
                .join(" ")}
              disabled
              className="group rounded-xl pr-9"
            >
              <RateDetails option={historicalOption} />
            </SelectItem>
          ) : null}
        </SelectContent>
      </Select>
      {error ? (
        <p id="rate_id-error" className="ms-1 text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
