import * as React from "react";
import { NextRequest } from "next/server";
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
import {
  getEmailFrom,
  getEmailTransportConfig,
  resolveEmailBranding,
} from "@/core/branding/email";
import type { EmailBrandingTheme } from "@/core/branding/types";

export async function sendTramiteStatusUpdatedNotification({
  user_to,
  tramite_id,
  status,
  link,
  req,
  client,
}: {
  user_to: { name: string; email: string; org_logo: string | undefined };
  tramite_id: string;
  status: { old: string; new: string };
  link: string;
  req: NextRequest;
  client: { name: string; last_name?: string | undefined };
}) {
  const emailBranding = await resolveEmailBranding({
    req,
    logoUrl: user_to.org_logo,
  });

  const transporter = nodemailer.createTransport(
    getEmailTransportConfig(emailBranding),
  );

  const tramiteLink = `${link}/tramites/${tramite_id}`;

  const emailHtml = await render(
    <TramiteStatusUpdateEmail
      name={user_to.name}
      tramiteLink={tramiteLink}
      status={status}
      client={client}
      displayName={emailBranding.branding.displayName}
      logoUrl={emailBranding.logoUrl}
      theme={emailBranding.theme}
    />
  );

  const mailOptions = {
    from: getEmailFrom(emailBranding),
    to: user_to.email,
    subject: `Actualización de Trámite - ${client.name} ${client.last_name}`,
    html: emailHtml,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (error) {
    console.error("Error al enviar el email:", error);
    throw new Error("No se pudo enviar el correo");
  }
}

const TramiteStatusUpdateEmail = ({
  name,
  tramiteLink,
  status,
  client,
  displayName,
  logoUrl,
  theme,
}: {
  name: string;
  tramiteLink: string;
  status: { old: string; new: string };
  client: { name: string; last_name?: string | undefined };
  displayName: string;
  logoUrl: string;
  theme: EmailBrandingTheme;
}) => {
  const currentYear = new Date().getFullYear();

  return (
    <Html lang="es">
      <Head>
        <title>
          Actualización de Trámite - {client.name} {client.last_name}
        </title>
      </Head>
      <Preview>
        El estado de tu trámite ha cambiado de {status.old} a {status.new}
      </Preview>
      <Tailwind>
        <Body
          className="py-[40px] font-sans text-[#333333]"
          style={{ backgroundColor: theme.bodyBg }}
        >
          <Container className="mx-auto bg-white rounded-[10px] shadow-lg overflow-hidden max-w-[600px]">
            <Section
              className="py-[30px] text-center"
              style={{ backgroundColor: theme.headerBg }}
            >
              <Img
                alt={`${displayName} Logo`}
                className="mx-auto"
                height={50}
                src={logoUrl}
              />
            </Section>

            <Section className="px-[50px] py-[40px] text-center">
              <Heading
                className="text-[24px] font-semibold m-0 mb-[20px]"
                style={{ color: theme.heading }}
              >
                Actualización de Trámite - {client.name}{" "}
                {client.last_name ?? ""}
              </Heading>

              <Text className="text-[16px] leading-[26px] m-0 mb-[15px]">
                Hola {name},
              </Text>

              <Text className="text-[16px] leading-[26px] m-0 mb-[15px]">
                El estado de tu trámite ha cambiado de{" "}
                <strong>{status.old}</strong> a <strong>{status.new}</strong>.
              </Text>

              <Section className="my-[30px]">
                <Button
                  href={tramiteLink}
                  className="text-white py-[14px] px-[26px] rounded-[6px] font-semibold text-[16px] no-underline inline-block shadow-md box-border"
                  style={{ backgroundColor: theme.buttonBg }}
                >
                  Ver Trámite
                </Button>
              </Section>

              <Text className="text-[16px] leading-[26px] m-0 mb-[15px]">
                Si el botón no funciona, copia y pega el siguiente enlace en tu
                navegador:
              </Text>

              <Text
                className="my-[10px] mb-[20px] py-[12px] px-[15px] rounded-[6px] text-[14px] border-l-4 text-[#666666] text-left"
                style={{
                  backgroundColor: theme.mutedBg,
                  borderColor: theme.buttonBg,
                }}
              >
                {tramiteLink}
              </Text>

              <Text className="text-[16px] leading-[26px] mt-[25px] mb-[10px]">
                Saludos,
                <br />
                El equipo de {displayName}
              </Text>
            </Section>

            <Section
              className="px-[50px] py-[30px] text-center border-t"
              style={{
                backgroundColor: theme.subtleBg,
                borderColor: theme.border,
              }}
            >
              <Text className="text-[#758195] text-[14px] m-0 mb-[15px]">
                Si tienes alguna duda, contáctanos en{" "}
                <Link
                  href="mailto:soporte@negococloud.es"
                  className="no-underline"
                  style={{ color: theme.link }}
                >
                  soporte@negococloud.es
                </Link>
              </Text>

              <Text className="text-[#758195] text-[13px] m-0">
                Este es un correo electrónico automático, por favor no respondas
                a este mensaje.
              </Text>

              <Text className="text-[#758195] text-[13px] mt-[15px] mb-0 m-0">
                &copy; {currentYear} {displayName}. Todos los
                derechos reservados.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default TramiteStatusUpdateEmail;
