/**
 * Redondeo a céntimos como en las facturas: mitad hacia arriba (lejos de
 * cero). El margen mínimo corrige el ruido binario de casos como 1.015, que
 * en coma flotante vale 1.01499999…
 */
export function roundEuros(value: number): number {
  const cents = Math.round(Math.abs(value) * 100 + 1e-7);
  return (Math.sign(value) * cents) / 100;
}

/** Suma importes ya redondeados sin arrastrar ruido de coma flotante. */
export function sumEuros(values: readonly number[]): number {
  return roundEuros(values.reduce((total, value) => total + value, 0));
}
