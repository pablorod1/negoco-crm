import nodemailer from "nodemailer";
import * as React from "react";
import {
  Img,
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  render,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";
import { NextRequest } from "next/server";
import {
  getEmailFrom,
  getEmailTransportConfig,
  resolveEmailBranding,
} from "@/core/branding/email";
import type { EmailBrandingTheme } from "@/core/branding/types";

export async function sendPasswordResetEmail({
  email,
  resetLink,
  req,
}: {
  email: string;
  resetLink: string;
  req: NextRequest;
}) {
  const emailBranding = await resolveEmailBranding({ req });
  const transporter = nodemailer.createTransport(
    getEmailTransportConfig(emailBranding),
  );

  const emailHtml = await render(
    <PasswordResetEmail
      resetLink={resetLink}
      displayName={emailBranding.branding.displayName}
      logoUrl={emailBranding.logoUrl}
      theme={emailBranding.theme}
    />,
  );
  // Configurar el email
  const mailOptions = {
    from: getEmailFrom(emailBranding),
    to: email,
    subject: `Restablecimiento de contraseña - ${emailBranding.branding.displayName}`,
    html: emailHtml,
  };

  try {
    // Enviar el email
    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (error) {
    console.error("Error al enviar el email:", error);
    throw error;
  }
}

const PasswordResetEmail = ({
  resetLink,
  displayName,
  logoUrl,
  theme,
}: {
  resetLink: string;
  displayName: string;
  logoUrl: string;
  theme: EmailBrandingTheme;
}) => {
  const currentYear = new Date().getFullYear();

  return (
    <Html lang="es">
      <Head>
        <title>Restablecimiento de Contraseña</title>
        <Preview>
          Solicitud para restablecer la contraseña de tu cuenta en {displayName}
        </Preview>
      </Head>
      <Tailwind>
        <Body
          className="py-[40px] font-sans text-[#333333] m-0 p-0"
          style={{ backgroundColor: theme.bodyBg }}
        >
          <Container className="max-w-[600px] mx-auto bg-white rounded-[10px] overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.1)]">
            {/* Header with logo */}
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

            {/* Main content */}
            <Section className="px-[50px] py-[40px]">
              <Heading
                className="text-[24px] font-semibold m-0 mb-[20px] text-center"
                style={{ color: theme.heading }}
              >
                Restablecimiento de Contraseña
              </Heading>

              <Text className="text-[16px] leading-[1.6] m-0 mb-[15px]">
                Hola,
              </Text>

              <Text className="text-[16px] leading-[1.6] m-0 mb-[15px]">
                Hemos recibido una solicitud para restablecer la contraseña de
                tu cuenta en <strong>{displayName}</strong>. Para continuar con
                este proceso y crear una nueva contraseña, haz clic en el botón
                de abajo:
              </Text>

              <Section className="my-[30px] text-center">
                <Button
                  href={resetLink}
                  className="text-white py-[14px] px-[26px] rounded-[6px] font-semibold text-[16px] no-underline inline-block shadow-[0_3px_6px_rgba(0,102,204,0.2)] box-border"
                  style={{ backgroundColor: theme.buttonBg }}
                >
                  Restablecer Contraseña
                </Button>
              </Section>

              <Text className="text-[16px] leading-[1.6] m-0 mb-[15px]">
                Si el botón no funciona, puedes copiar y pegar la siguiente URL
                en tu navegador:
              </Text>

              <Text
                className="m-0 mb-[20px] mt-[10px] py-[12px] px-[15px] rounded-[6px] text-[14px] break-all border-l-[4px] text-[#666]"
                style={{
                  backgroundColor: theme.mutedBg,
                  borderLeftColor: theme.buttonBg,
                }}
              >
                {resetLink}
              </Text>

              <Text className="text-[16px] leading-[1.6] m-0 mb-[15px] text-[#777777]">
                <strong>Nota:</strong> Este enlace expirará en 24 horas por
                motivos de seguridad.
              </Text>

              <Text className="text-[16px] leading-[1.6] m-0 mb-[15px]">
                Si no has solicitado este cambio de contraseña, puedes ignorar
                este correo. Tu contraseña actual seguirá siendo válida.
              </Text>

              <Text className="text-[16px] leading-[1.6] m-0 mt-[25px] mb-[10px]">
                Saludos,
                <br />
                El equipo de {displayName}
              </Text>
            </Section>

            {/* Footer */}
            <Section
              className="px-[50px] py-[30px] text-center border-t-[1px]"
              style={{
                backgroundColor: theme.subtleBg,
                borderTopColor: theme.border,
              }}
            >
              <Text className="m-0 mb-[15px] text-[#758195] text-[14px]">
                Si tienes alguna duda, contáctanos en{" "}
                <a
                  href="mailto:soporte@negococloud.es"
                  className="no-underline"
                  style={{ color: theme.link }}
                >
                  soporte@negococloud.es
                </a>
              </Text>

              <Text className="m-0 text-[#758195] text-[13px]">
                Este es un correo electrónico automático, por favor no respondas
                a este mensaje.
              </Text>

              <Text className="m-0 mt-[15px] text-[#758195] text-[13px]">
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

export default PasswordResetEmail;
