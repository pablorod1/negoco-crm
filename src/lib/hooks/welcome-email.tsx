import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";
import nodemailer from "nodemailer";
import { NextRequest } from "next/server";

export async function sendWelcomeEmail({
  email_to,
  name,
  req,
  link,
}: {
  email_to: string;
  name: string;
  req: NextRequest;
  link: string;
}) {
  const host = req.headers.get("host");
  if (!host) {
    throw new Error("No host found in request headers");
  }

  // Extraer el subdominio (client1, client2, etc.)
  const subdomain = host.split(".")[0];
  const email =
    subdomain === "localhost:3000" || "negococloud"
      ? process.env.EMAIL
      : process.env[`EMAIL_${subdomain.toUpperCase()}`];
  const password =
    subdomain === "localhost:3000" || "negococloud"
      ? process.env.EMAIL_PASS
      : process.env[`EMAIL_PASS_${subdomain.toUpperCase()}`];

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST, // Aquí va smtp.dondominio.com
    port: Number(process.env.SMTP_PORT), // Puerto 587 para STARTTLS o 465 para SSL
    secure: false, // `true` para SSL en 465, `false` para STARTTLS en 587
    auth: {
      user: email,
      pass: password,
    },
  });

  // Configurar el email
  const mailOptions = {
    from: `${subdomain.toUpperCase()} <${email}>`,
    to: email_to,
    subject: `Bienvenido a Negoco Cloud - ${subdomain.toUpperCase()}`,
    html: WelcomeEmail(name, link).toString(),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (error) {
    console.error("Error al enviar el email:", error);
    throw new Error("Error al enviar el email");
  }
}

const WelcomeEmail = (name: string, link: string) => {
  const currentYear = new Date().getFullYear();

  return (
    <Html>
      <Head />
      <Preview>
        Bienvenido a Negoco Cloud - Su nueva plataforma CRM para consultoría
        energética
      </Preview>
      <Tailwind>
        <Body className="bg-[#f6f9fc] font-sans py-[40px]">
          <Container className="bg-white rounded-[8px] mx-auto p-[20px] max-w-[600px]">
            {/* Header */}
            <Section className="mt-[32px]">
              <Heading className="text-[24px] font-bold text-center text-[#1a3e6f] m-0">
                Bienvenido a Negoco Cloud
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
                ¡Gracias por elegir <strong>Negoco Cloud</strong>! Estamos
                encantados de darle la bienvenida a nuestra plataforma CRM
                especializada en consultoría energética.
              </Text>
              <Text className="text-[16px] text-gray-700 mb-[24px]">
                Con Negoco Cloud, ahora tiene acceso a:
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
                  className="bg-[#1a3e6f] text-white font-bold py-[12px] px-[24px] rounded-[4px] no-underline text-center box-border"
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
                  className="text-[#1a3e6f]"
                >
                  soporte@negococloud.es
                </a>
              </Text>
              <Text className="text-[14px] text-center text-gray-500 mb-[32px]">
                ¡Le deseamos mucho éxito con Negoco Cloud!
              </Text>

              <Hr className="border-[#e6ebf1] my-[20px]" />

              <Text className="text-[12px] text-center text-gray-400 m-0">
                © {currentYear} Negoco Cloud. Todos los derechos reservados.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default WelcomeEmail;
