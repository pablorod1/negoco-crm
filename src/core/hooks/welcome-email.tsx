import * as React from "react";
import {
  Img,
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  render,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";
import nodemailer from "nodemailer";
import { NextRequest } from "next/server";
import {
  getEmailFrom,
  getEmailTransportConfig,
  resolveEmailBranding,
} from "@/core/branding/email";
import type { EmailBrandingTheme } from "@/core/branding/types";

export async function sendWelcomeEmail({
  email_to,
  name,
  req,
  link,
  org_logo,
}: {
  email_to: string;
  name: string;
  req: NextRequest;
  link: string;
  org_logo: string | undefined;
}) {
  const emailBranding = await resolveEmailBranding({ req, logoUrl: org_logo });

  const transporter = nodemailer.createTransport(
    getEmailTransportConfig(emailBranding),
  );

  // Configurar el email
  const emailHtml = await render(
    <WelcomeEmail
      name={name}
      link={link}
      displayName={emailBranding.branding.displayName}
      logoUrl={emailBranding.logoUrl}
      theme={emailBranding.theme}
    />
  );
  const mailOptions = {
    from: getEmailFrom(emailBranding),
    to: email_to,
    subject: `Bienvenido a ${emailBranding.branding.displayName}`,
    html: emailHtml,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return { success: true, info };
  } catch (error) {
    console.error("Error al enviar el email:", error);
    return { success: false, error: "Error sending email" };
  }
}

const WelcomeEmail = ({
  name,
  link,
  displayName,
  logoUrl,
  theme,
}: {
  name: string;
  link: string;
  displayName: string;
  logoUrl: string;
  theme: EmailBrandingTheme;
}) => {
  const currentYear = new Date().getFullYear();

  return (
    <Html>
      <Head />
      <Preview>
        Bienvenido a {displayName} - Su nueva plataforma CRM para consultoría
        energética
      </Preview>
      <Tailwind>
        <Body className="font-sans py-[40px]" style={{ backgroundColor: theme.bodyBg }}>
          <Container className="bg-white rounded-[8px] mx-auto p-[20px] max-w-[600px]">
            {/* Header */}
            <Section className="mt-[32px]">
              <Img
                alt={`${displayName} Logo`}
                className="mx-auto mb-6"
                height={50}
                src={logoUrl}
              />
              <Heading
                className="text-[24px] font-bold text-center m-0"
                style={{ color: theme.heading }}
              >
                Bienvenido a {displayName}
              </Heading>
              <Text className="text-[16px] text-center text-gray-600">
                La plataforma CRM líder en consultoría energética en España
              </Text>
            </Section>

            <Hr className="border-[#e6ebf1] my-[20px]" />

            {/* Main Content */}
            <Section>
              <Text className="text-[16px] text-gray-700 mb-[24px]">
                Estimado {name},
              </Text>
              <Text className="text-[16px] text-gray-700 mb-[24px]">
                ¡Gracias por elegir <strong>{displayName}</strong>! Estamos
                encantados de darle la bienvenida a nuestra plataforma CRM
                especializada en consultoría energética.
              </Text>
              <Text className="text-[16px] text-gray-700 mb-[24px]">
                Con {displayName}, ahora tiene acceso a:
              </Text>

              <Section className="pl-[16px] mb-[24px]">
                <Text className="text-[16px] text-gray-700 m-0">
                  • Gestión integral de clientes y proyectos energéticos
                </Text>
                <Text className="text-[16px] text-gray-700 m-0">
                  • Análisis avanzado de consumo y eficiencia energética
                </Text>
                <Text className="text-[16px] text-gray-700 m-0">
                  • Herramientas de seguimiento de regulaciones energéticas
                  españolas
                </Text>
                <Text className="text-[16px] text-gray-700 m-0">
                  • Informes personalizados para sus clientes
                </Text>
                <Text className="text-[16px] text-gray-700 m-0">
                  • Soporte técnico especializado en el sector energético
                </Text>
              </Section>

              <Text className="text-[16px] text-gray-700 mb-[24px]">
                Su cuenta ya está activa y lista para usar. Puede acceder
                inmediatamente con las credenciales que ha recibido por
                separado.
              </Text>

              <Section className="text-center mb-[32px]">
                <Button
                  className="text-white font-bold py-[12px] px-[24px] rounded-[4px] no-underline text-center box-border"
                  style={{ backgroundColor: theme.buttonBg }}
                  href={`${link}/login`}
                >
                  Acceder a mi cuenta
                </Button>
              </Section>
            </Section>

            <Hr className="border-[#e6ebf1] my-[20px]" />

            {/* Footer */}
            <Section>
              <Text className="text-[14px] text-center text-gray-500">
                Si tiene alguna pregunta, no dude en contactar con nuestro
                equipo de soporte en{" "}
                <a
                  href="mailto:soporte@negococloud.es"
                  style={{ color: theme.link }}
                >
                  soporte@negococloud.es
                </a>
              </Text>
              <Text className="text-[14px] text-center text-gray-500 mb-[32px]">
                ¡Le deseamos mucho éxito con {displayName}!
              </Text>

              <Hr className="border-[#e6ebf1] my-[20px]" />

              <Text className="text-[12px] text-center text-gray-400 m-0">
                © {currentYear} {displayName}. Todos los derechos reservados.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default WelcomeEmail;
