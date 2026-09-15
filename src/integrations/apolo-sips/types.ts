export type ApoloSipsProcedure = "PS" | "CONSUMOS";

export type ApoloSipsSupplyType = "ELECTRICIDAD" | "GAS";

export interface ApoloSipsProcedureResult<TRow> {
  procedure: ApoloSipsProcedure;
  supplyType: ApoloSipsSupplyType;
  columns: string[];
  rows: TRow[];
  rowCount: number;
  hasData: boolean;
}

export interface ApoloSipsBaseRequest {
  cups: string;
  tipoSuministro: ApoloSipsSupplyType;
}

export interface ApoloSipsApiRequest extends ApoloSipsBaseRequest {
  procedimientos: ApoloSipsProcedure[];
}

export interface ApoloSipsElectricityPointSupplyRow {
  codigoEmpresaDistribuidora: string | null;
  cups: string | null;
  nombreEmpresaDistribuidora: string | null;
  codigoPostalPS: string | null;
  municipioPS: string | null;
  codigoProvinciaPS: string | null;
  fechaAltaSuministro: string | null;
  codigoTarifaATREnVigor: string | null;
  codigoTensionV: string | null;
  potenciaMaximaBIEW: number | null;
  potenciaMaximaAPMW: number | null;
  codigoClasificacionPS: string | null;
  codigoDisponibilidadICP: string | null;
  tipoPerfilConsumo: string | null;
  valorDerechosExtensionW: number | null;
  valorDerechosAccesoW: number | null;
  codigoPropiedadEquipoMedida: string | null;
  codigoPropiedadICP: string | null;
  potenciasContratadasEnWP1: number | null;
  potenciasContratadasEnWP2: number | null;
  potenciasContratadasEnWP3: number | null;
  potenciasContratadasEnWP4: number | null;
  potenciasContratadasEnWP5: number | null;
  potenciasContratadasEnWP6: number | null;
  fechaUltimoMovimientoContrato: string | null;
  fechaUltimoCambioComercializador: string | null;
  fechaLimiteDerechosReconocidos: string | null;
  fechaUltimaLectura: string | null;
  informacionImpagos: string | null;
  importeDepositoGarantiaEuros: number | null;
  tipoIdTitular: string | null;
  esViviendaHabitual: string | null;
  codigoComercializadora: string | null;
  codigoTelegestion: string | null;
  codigoFasesEquipoMedida: string | null;
  codigoAutoconsumo: string | null;
  codigoTipoContrato: string | null;
  codigoPeriodicidadFacturacion: string | null;
  codigoBIE: string | null;
  fechaEmisionBIE: string | null;
  fechaCaducidadBIE: string | null;
  codigoAPM: string | null;
  fechaEmisionAPM: string | null;
  fechaCaducidadAPM: string | null;
  relacionTransformacionIntensidad: number | null;
  cnae: string | null;
  codigoModoControlPotencia: string | null;
  potenciaCGPW: number | null;
  codigoDHEquipoDeMedida: string | null;
  codigoAccesibilidadContador: string | null;
  codigoPSContratable: string | null;
  motivoEstadoNoContratable: string | null;
  codigoTensionMedida: string | null;
  codigoClaseExpediente: string | null;
  codigoMotivoExpediente: string | null;
  codigoTipoSuministro: string | null;
  aplicacionBonoSocial: string | null;
}

export interface ApoloSipsElectricityConsumptionRow {
  cups: string | null;
  fechaInicioMesConsumo: string | null;
  fechaFinMesConsumo: string | null;
  codigoTarifaATR: string | null;
  consumoEnergiaActivaEnWhP1: number | null;
  consumoEnergiaActivaEnWhP2: number | null;
  consumoEnergiaActivaEnWhP3: number | null;
  consumoEnergiaActivaEnWhP4: number | null;
  consumoEnergiaActivaEnWhP5: number | null;
  consumoEnergiaActivaEnWhP6: number | null;
  consumoEnergiaReactivaEnVArhP1: number | null;
  consumoEnergiaReactivaEnVArhP2: number | null;
  consumoEnergiaReactivaEnVArhP3: number | null;
  consumoEnergiaReactivaEnVArhP4: number | null;
  consumoEnergiaReactivaEnVArhP5: number | null;
  consumoEnergiaReactivaEnVArhP6: number | null;
  potenciaDemandadaEnWP1: number | null;
  potenciaDemandadaEnWP2: number | null;
  potenciaDemandadaEnWP3: number | null;
  potenciaDemandadaEnWP4: number | null;
  potenciaDemandadaEnWP5: number | null;
  potenciaDemandadaEnWP6: number | null;
  codigoDHEquipoDeMedida: string | null;
  codigoTipoLectura: string | null;
}

export interface ApoloSipsGasPointSupplyRow {
  codigoEmpresaDistribuidora: string | null;
  nombreEmpresaDistribuidora: string | null;
  cups: string | null;
  codigoProvinciaPS: string | null;
  desProvinciaPS: string | null;
  codigoPostalPS: string | null;
  municipioPS: string | null;
  desmunicipioPS: string | null;
  tipoViaPS: string | null;
  viaPS: string | null;
  numFincaPS: string | null;
  portalPS: string | null;
  escaleraPS: string | null;
  pisoPS: string | null;
  puertaPS: string | null;
  codigoPresion: string | null;
  codigoPeajeEnVigor: string | null;
  caudalMaximoDiarioEnWh: number | null;
  caudalHorarioEnWh: number | null;
  derechoTUR: string | null;
  fechaUltimaInspeccion: string | null;
  codigoResultadoInspeccion: string | null;
  tipoPerfilConsumo: string | null;
  codigoContador: string | null;
  calibreContador: string | null;
  tipoContador: string | null;
  propiedadEquipoMedida: string | null;
  codigoTelemedida: string | null;
  fechaUltimoMovimientoContrato: string | null;
  fechaUltimoCambioComercializador: string | null;
  informacionImpagos: string | null;
  idTipoTitular: string | null;
  idTitular: string | null;
  nombreTitular: string | null;
  apellido1Titular: string | null;
  apellido2Titular: string | null;
  codigoProvinciaTitular: string | null;
  desProvinciaTitular: string | null;
  codigoPostalTitular: string | null;
  municipioTitular: string | null;
  desMunicipioTitular: string | null;
  tipoViaTitular: string | null;
  viaTitular: string | null;
  numFincaTitular: string | null;
  portalTitular: string | null;
  escaleraTitular: string | null;
  pisoTitular: string | null;
  puertaTitular: string | null;
  esViviendaHabitual: string | null;
  cnae: string | null;
  tipoCorrector: string | null;
  codigoAccesibilidadContador: string | null;
  conectadoPlantaSatelite: string | null;
  pctd: number | null;
  presionMedida: number | null;
}

export interface ApoloSipsGasConsumptionRow {
  cups: string | null;
  fechaInicioMesConsumo: string | null;
  fechaFinMesConsumo: string | null;
  codigoTarifaPeaje: string | null;
  consumoEnWhP1: number | null;
  consumoEnWhP2: number | null;
  caudalMedioEnWhdia: number | null;
  caudaMinimoDiario: number | null;
  caudaMaximoDiario: number | null;
  porcentajeConsumoNocturno: number | null;
  codigoTipoLectura: string | null;
}

export type ApoloSipsPointSupplyRow =
  | ApoloSipsElectricityPointSupplyRow
  | ApoloSipsGasPointSupplyRow;

export type ApoloSipsConsumptionRow =
  | ApoloSipsElectricityConsumptionRow
  | ApoloSipsGasConsumptionRow;

export type ApoloSipsProcedureRow =
  | ApoloSipsPointSupplyRow
  | ApoloSipsConsumptionRow;

export type ApoloSipsResponseData =
  | {
      cups: string;
      tipoSuministro: "ELECTRICIDAD";
      ps?: ApoloSipsProcedureResult<ApoloSipsElectricityPointSupplyRow>;
      consumos?: ApoloSipsProcedureResult<ApoloSipsElectricityConsumptionRow>;
    }
  | {
      cups: string;
      tipoSuministro: "GAS";
      ps?: ApoloSipsProcedureResult<ApoloSipsGasPointSupplyRow>;
      consumos?: ApoloSipsProcedureResult<ApoloSipsGasConsumptionRow>;
    };

export type ApoloSipsApiResponse =
  | {
      success: true;
      data: ApoloSipsResponseData;
    }
  | {
      success: false;
      error: string;
      details?: unknown;
    };
