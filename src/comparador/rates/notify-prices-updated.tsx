import * as React from "react";
import type { Client } from "@libsql/client";
import nodemailer from "nodemailer";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
  Tailwind,
  render,
} from "@react-email/components";
import { getEmailFrom, getEmailTransportConfig, resolveEmailBranding } from "@/core/branding/email";
import type { EmailBrandingTheme } from "@/core/branding/types";
import type { RateExtractionResult } from "./extract";
import { senderAddress } from "./inbound";
import { getComercializadora, getIngest, type IngestRecord } from "./repository";
import { dayInSpain, PENDING_PART_PREFIX } from "./service";
import { isInScope } from "./validate";

type TenantClient = Pick<Client, "execute" | "batch">;

/**
 * URL del CRM de un tenant para el enlace del correo. Desde el CRM vale su
 * propio origen; desde el buzón (api.negococloud.es) se usa
 * COMPARADOR_TENANT_URL, con «{tenant}» (en el piloto,
 * https://{tenant}-comparador.negococloud.es).
 */
export function tenantAppUrl(tenantSlug: string, request?: Request, env: Record<string, string | undefined> = process.env) {
  if (request) {
    const url = new URL(request.url);
    if (!url.hostname.startsWith("api.")) return url.origin;
  }
  return (env.COMPARADOR_TENANT_URL ?? "https://{tenant}.negococloud.es").replace("{tenant}", tenantSlug);
}

/**
 * Avisa a quien envió un anexo de que sus precios ya están actualizados, cuando
 * está aplicado entero: si se apartó algo para que lo revise Negoco, al
 * aprobar la última parte. Solo con COMPARADOR_PRICE_UPDATE_EMAILS=1. Un fallo
 * al enviar no deshace nada: solo queda en el log.
 */
export async function notifyPricesUpdated({
  client,
  ingest,
  tenantSlug,
  request,
}: {
  client: TenantClient;
  ingest: IngestRecord;
  tenantSlug: string;
  /** Para la marca del correo y el enlace. */
  request: Request;
}): Promise<boolean> {
  if (process.env.COMPARADOR_PRICE_UPDATE_EMAILS !== "1") return false;
  try {
    const rootId = ingest.createdBy?.startsWith(PENDING_PART_PREFIX)
      ? ingest.createdBy.slice(PENDING_PART_PREFIX.length)
      : ingest.id;
    const root = rootId === ingest.id ? ingest : await getIngest(client, rootId);
    if (!root || root.status !== "approved" || !root.comercializadoraId) return false;

    // Mientras quede una parte por revisar, el anexo no está aplicado entero.
    const { rows: pending } = await client.execute({
      sql: `SELECT 1 FROM rate_ingests WHERE created_by = ? AND status IN ('received', 'processing', 'ready', 'needs_review') LIMIT 1`,
      args: [`${PENDING_PART_PREFIX}${root.id}`],
    });
    if (pending.length > 0) return false;

    const recipient = await recipientOf(client, root);
    if (!recipient) return false;

    const supplier = await getComercializadora(client, root.comercializadoraId);
    const result = root.extraction as RateExtractionResult | null;
    const rates = result && result.status !== "out_of_scope" ? result.proposed.filter(isInScope).length : 0;
    const commissions = result && result.status !== "out_of_scope" ? result.extraction.commissions.length > 0 : false;
    const { rows: version } = root.versionId
      ? await client.execute({ sql: "SELECT valid_from FROM comercializadora_rate_versions WHERE id = ?", args: [root.versionId] })
      : { rows: [] };
    const validFrom = version[0]?.valid_from ? String(version[0].valid_from) : null;

    const branding = await resolveEmailBranding({ req: request });
    const link = `${tenantAppUrl(tenantSlug, request)}/comercializadoras/${root.comercializadoraId}`;
    const supplierName = supplier?.name ?? "la comercializadora";
    const html = await render(
      <PricesUpdatedEmail
        name={recipient.name}
        supplierName={supplierName}
        fileName={root.files[0]?.name ?? null}
        receivedOn={dayInSpain(root.receivedAt)}
        rates={rates}
        commissions={commissions}
        validFrom={validFrom}
        link={link}
        displayName={branding.branding.displayName}
        logoUrl={branding.logoUrl}
        theme={branding.theme}
      />,
    );
    await nodemailer.createTransport(getEmailTransportConfig(branding)).sendMail({
      from: getEmailFrom(branding),
      to: recipient.email,
      subject: `Precios de ${supplierName} actualizados`,
      html,
    });
    console.info("[comparador] aviso de precios actualizados", { tenantSlug, ingest: root.id, to: recipient.email });
    return true;
  } catch (error) {
    console.error("[comparador] no se ha podido avisar de los precios actualizados", ingest.id, error);
    return false;
  }
}

/** Quien envió el anexo: el remitente del correo o quien lo subió. */
async function recipientOf(client: TenantClient, ingest: IngestRecord): Promise<{ email: string; name: string } | null> {
  const byEmail = ingest.emailFrom ? senderAddress(ingest.emailFrom) : null;
  const { rows } = await client.execute({
    sql: byEmail
      ? "SELECT email, name FROM user WHERE lower(email) = ? LIMIT 1"
      : "SELECT email, name FROM user WHERE id = ? LIMIT 1",
    args: [byEmail ?? ingest.createdBy ?? ""],
  });
  if (rows[0]) return { email: String(rows[0].email), name: String(rows[0].name ?? "") };
  return byEmail ? { email: byEmail, name: "" } : null;
}

const formatDay = (day: string) => day.split("-").reverse().join("/");

function PricesUpdatedEmail({
  name,
  supplierName,
  fileName,
  receivedOn,
  rates,
  commissions,
  validFrom,
  link,
  displayName,
  logoUrl,
  theme,
}: {
  name: string;
  supplierName: string;
  fileName: string | null;
  receivedOn: string;
  rates: number;
  commissions: boolean;
  validFrom: string | null;
  link: string;
  displayName: string;
  logoUrl: string;
  theme: EmailBrandingTheme;
}) {
  const what = [
    rates > 0 ? `${rates === 1 ? "1 tarifa" : `${rates} tarifas`}` : null,
    commissions ? "las comisiones" : null,
  ].filter(Boolean).join(" y ");
  return (
    <Html lang="es">
      <Head>
        <title>Precios de {supplierName} actualizados</title>
      </Head>
      <Preview>Ya están aplicados los precios de {supplierName} que nos enviasteis.</Preview>
      <Tailwind>
        <Body className="py-[40px] font-sans text-[#333333]" style={{ backgroundColor: theme.bodyBg }}>
          <Container className="mx-auto bg-white rounded-[10px] shadow-lg overflow-hidden max-w-[600px]">
            <Section className="py-[30px] text-center" style={{ backgroundColor: theme.headerBg }}>
              <Img alt={`${displayName} Logo`} className="mx-auto" height={50} src={logoUrl} />
            </Section>
            <Section className="px-[50px] py-[40px] text-center">
              <Heading className="text-[24px] font-semibold m-0 mb-[20px]" style={{ color: theme.heading }}>
                Precios de {supplierName} actualizados
              </Heading>
              <Text className="text-[16px] leading-[26px] m-0 mb-[15px]">Hola{name ? ` ${name}` : ""},</Text>
              <Text className="text-[16px] leading-[26px] m-0 mb-[15px]">
                Ya están aplicados {what ? <strong>{what}</strong> : "los precios"} del anexo
                {fileName ? <> «{fileName}»</> : null} que nos enviasteis el {formatDay(receivedOn)}
                {validFrom ? <>, vigentes desde el <strong>{formatDay(validFrom)}</strong></> : null}. Los estudios
                que hagáis a partir de ahora ya los usan.
              </Text>
              <Section className="my-[30px]">
                <Button
                  href={link}
                  className="text-white py-[14px] px-[26px] rounded-[6px] font-semibold text-[16px] no-underline inline-block shadow-md box-border"
                  style={{ backgroundColor: theme.buttonBg }}
                >
                  Ver las tarifas
                </Button>
              </Section>
              <Text className="text-[14px] leading-[22px] m-0 text-[#666666]">
                Solo se actualiza lo que nos enviáis: si os llega un anexo nuevo, reenviadlo al buzón de tarifas.
              </Text>
            </Section>
            <Section
              className="px-[50px] py-[30px] text-center border-t"
              style={{ backgroundColor: theme.subtleBg, borderColor: theme.border }}
            >
              <Text className="text-[#758195] text-[14px] m-0 mb-[15px]">
                Si tienes alguna duda, contáctanos en{" "}
                <Link href="mailto:soporte@negococloud.es" className="no-underline" style={{ color: theme.link }}>
                  soporte@negococloud.es
                </Link>
              </Text>
              <Text className="text-[#758195] text-[13px] m-0">
                Este es un correo electrónico automático, por favor no respondas a este mensaje.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
