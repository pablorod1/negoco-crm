import { clientFromInvoiceText } from "./invoice-client";
import { redactInvoiceText } from "./redact";

/**
 * El anonimizado de una factura para un estudio, igual en producción y en el
 * banco de pruebas: los datos del titular se leen en local y, además de
 * rellenar el cliente, se tapan en todo el texto aunque no lleven etiqueta.
 */
export function redactInvoiceForStudy(text: string, { fromImage = false } = {}) {
  const clientData = clientFromInvoiceText(text.replace(/\t/g, "\n"));
  const redaction = redactInvoiceText(text, {
    fromImage,
    knownHolderTokens: [clientData?.name, clientData?.lastName, clientData?.address]
      .filter((value): value is string => Boolean(value))
      .flatMap((value) => value.split(/\s+/)),
  });
  return { clientData, redaction };
}
