import { roundEuros, sumEuros } from "./money";
import type { RegulatedParams } from "./regulated";
import type {
  CostBreakdown,
  EnergyByPeriod,
  PowerByPeriod,
  SupplyProfile,
  TariffPrices,
} from "./types";

export const DAYS_PER_YEAR = 365;

export interface CostInput {
  days: number;
  contractedKw: PowerByPeriod;
  energyKwh: EnergyByPeriod;
  prices: TariffPrices;
  regulated: RegulatedParams;
  /** Descuentos sobre el importe de la energía, en tanto por uno. */
  energyDiscountRates?: readonly number[];
  /** El alquiler puede cubrir días distintos de los de la potencia. */
  meterRental: { perDay: number; days?: number };
  /** Servicios del periodo en €; si falta, se prorratean los anuales. */
  servicesAmount?: number;
  /** Otros importes con IEE del periodo; si falta, se prorratean los anuales. */
  otherElectricityAmount?: number;
  /** Conceptos sin IVA del periodo; si falta, se prorratean los anuales. */
  vatExemptAmount?: number;
}

/**
 * Coste de un periodo con el desglose de una factura 2.0TD. Cada línea se
 * redondea a céntimos antes de sumarse, como hacen las comercializadoras.
 *
 * El bono social entra en la base del IEE y en la base imponible del IVA;
 * el alquiler y los servicios solo en la del IVA.
 */
export function computeCost(input: CostInput): CostBreakdown {
  const { days, contractedKw, energyKwh, prices, regulated } = input;

  const power = {
    P1: roundEuros(contractedKw.P1 * days * prices.power.P1),
    P2: roundEuros(contractedKw.P2 * days * prices.power.P2),
  };
  const powerTotal = sumEuros([power.P1, power.P2]);

  const energy = {
    P1: roundEuros(energyKwh.P1 * prices.energy.P1),
    P2: roundEuros(energyKwh.P2 * prices.energy.P2),
    P3: roundEuros(energyKwh.P3 * prices.energy.P3),
  };
  const energyTotal = sumEuros([energy.P1, energy.P2, energy.P3]);

  const energyDiscounts = (input.energyDiscountRates ?? []).map((rate) =>
    roundEuros(-energyTotal * rate),
  );
  const otherElectricity = roundEuros(
    input.otherElectricityAmount ??
      ((prices.otherElectricityPerYear ?? 0) * days) / DAYS_PER_YEAR,
  );
  const socialBonus = roundEuros(days * regulated.socialBonusPerDay);

  const electricitySubtotal = sumEuros([
    powerTotal,
    energyTotal,
    ...energyDiscounts,
    otherElectricity,
    socialBonus,
  ]);
  const electricityTax = roundEuros(
    electricitySubtotal * regulated.electricityTaxRate,
  );

  const meterRental = roundEuros(
    (input.meterRental.days ?? days) * input.meterRental.perDay,
  );
  const services = roundEuros(
    input.servicesAmount ??
      ((prices.servicesPerYear ?? 0) * days) / DAYS_PER_YEAR,
  );

  const taxableBase = sumEuros([
    electricitySubtotal,
    electricityTax,
    meterRental,
    services,
  ]);
  const vat = roundEuros(taxableBase * regulated.vatRate);
  const vatExempt = roundEuros(
    input.vatExemptAmount ??
      ((prices.vatExemptPerYear ?? 0) * days) / DAYS_PER_YEAR,
  );

  return {
    days,
    power: { ...power, total: powerTotal },
    energy: { ...energy, total: energyTotal },
    energyDiscounts,
    otherElectricity,
    socialBonus,
    electricitySubtotal,
    electricityTax,
    meterRental,
    services,
    taxableBase,
    vat,
    vatExempt,
    total: sumEuros([taxableBase, vat, vatExempt]),
  };
}

/** Coste de un año completo con el consumo anual del suministro. */
export function computeAnnualCost(
  profile: SupplyProfile,
  prices: TariffPrices,
  regulated: RegulatedParams,
): CostBreakdown {
  return computeCost({
    days: DAYS_PER_YEAR,
    contractedKw: profile.contractedKw,
    energyKwh: profile.annualKwh,
    prices,
    regulated,
    meterRental: { perDay: profile.meterRentalPerDay },
  });
}

export interface Fee {
  /** €/MWh que se suman a cada periodo de energía. */
  energyPerMwh: number;
  /** €/kW·año que se suman a cada periodo de potencia. */
  powerPerKwYear: number;
}

/** Precios al cliente con el fee de la agencia incluido. */
export function applyFee(prices: TariffPrices, fee: Fee): TariffPrices {
  const energyExtra = fee.energyPerMwh / 1000;
  const powerExtra = fee.powerPerKwYear / DAYS_PER_YEAR;

  return {
    ...prices,
    power: {
      P1: prices.power.P1 + powerExtra,
      P2: prices.power.P2 + powerExtra,
    },
    energy: {
      P1: prices.energy.P1 + energyExtra,
      P2: prices.energy.P2 + energyExtra,
      P3: prices.energy.P3 + energyExtra,
    },
  };
}
