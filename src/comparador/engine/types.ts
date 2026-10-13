/** Periodos de potencia de la 2.0TD. */
export interface PowerByPeriod {
  P1: number;
  P2: number;
}

/** Periodos de energía de la 2.0TD. */
export interface EnergyByPeriod {
  P1: number;
  P2: number;
  P3: number;
}

/** Precios de una tarifa 2.0TD de precio fijo. */
export interface TariffPrices {
  /** €/kW·día. */
  power: PowerByPeriod;
  /** €/kWh. */
  energy: EnergyByPeriod;
  /** Servicios incluidos en la tarifa, en €/año. Llevan IVA pero no IEE. */
  servicesPerYear?: number;
  /**
   * Otros importes sujetos al IEE (margen de intermediación, excesos,
   * reactiva…), en €/año.
   */
  otherElectricityPerYear?: number;
  /** Conceptos sin IVA (seguros…), en €/año. Suman al total fuera de la base. */
  vatExemptPerYear?: number;
}

/** Suministro tal como se compara: potencias y consumo anual. */
export interface SupplyProfile {
  contractedKw: PowerByPeriod;
  /** Consumo de los últimos 12 meses (SIPS) o la factura anualizada. */
  annualKwh: EnergyByPeriod;
  /** Alquiler del contador en €/día, tal como aparece en la factura. */
  meterRentalPerDay: number;
}

export interface CostBreakdown {
  days: number;
  power: PowerByPeriod & { total: number };
  energy: EnergyByPeriod & { total: number };
  /** Descuentos sobre la energía, la potencia o un importe fijo, en negativo. */
  energyDiscounts: number[];
  /**
   * Servicios de ajuste simulados, para las tarifas que los cobran aparte.
   * Entran en la base del IEE. Falta en propuestas anteriores al 2026-10-14.
   */
  ancillary?: number;
  /** Cuota de una tarifa plana: lleva dentro energía, potencia, IEE y contador. */
  flatFee?: number;
  otherElectricity: number;
  socialBonus: number;
  /** Base del IEE: potencia + energía − descuentos + SSAA + otros + bono social. */
  electricitySubtotal: number;
  electricityTax: number;
  meterRental: number;
  services: number;
  taxableBase: number;
  vat: number;
  vatExempt: number;
  total: number;
}
