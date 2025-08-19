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

export async function sendPasswordResetEmail({
  email,
  resetLink,
}: {
  email: string;
  resetLink: string;
}) {
  const emailFrom = process.env.EMAIL_NOREPLY || "";
  const password = process.env.EMAIL_PASS_NOREPLY || "";
  // Configurar el transporter de nodemailer
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: 465,
    secure: true,
    auth: {
      user: emailFrom,
      pass: password,
    },
  });

  const emailHtml = await render(<PasswordResetEmail resetLink={resetLink} />);
  // Configurar el email
  const mailOptions = {
    from: {
      address: emailFrom,
      name: "Negoco Cloud Soporte",
    },
    to: email,
    subject: `Restablecimiento de contraseña - Negoco Cloud`,
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

const PasswordResetEmail = ({ resetLink }: { resetLink: string }) => {
  return (
    <Html lang="es">
      <Head>
        <title>Restablecimiento de Contraseña</title>
        <Preview>
          Solicitud para restablecer la contraseña de tu cuenta en Negoco Cloud
        </Preview>
      </Head>
      <Tailwind>
        <Body className="bg-[#f7f9fc] py-[40px] font-sans text-[#333333] m-0 p-0">
          <Container className="max-w-[600px] mx-auto bg-white rounded-[10px] overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.1)]">
            {/* Header with logo */}
            <Section className="bg-[#f0f6ff] py-[30px] text-center">
              <Img
                alt="Negoco Cloud Logo"
                className="mx-auto"
                height={50}
                src="https://negococloud.es/favicon.png"
              />
            </Section>

            {/* Main content */}
            <Section className="px-[50px] py-[40px]">
              <Heading className="text-[#0066cc] text-[24px] font-semibold m-0 mb-[20px] text-center">
                Restablecimiento de Contraseña
              </Heading>

              <Text className="text-[16px] leading-[1.6] m-0 mb-[15px]">
                Hola,
              </Text>

              <Text className="text-[16px] leading-[1.6] m-0 mb-[15px]">
                Hemos recibido una solicitud para restablecer la contraseña de
                tu cuenta en <strong>Negoco Cloud</strong>. Para continuar con
                este proceso y crear una nueva contraseña, haz clic en el botón
                de abajo:
              </Text>

              <Section className="my-[30px] text-center">
                <Button
                  href={resetLink}
                  className="bg-[#0066cc] text-white py-[14px] px-[26px] rounded-[6px] font-semibold text-[16px] no-underline inline-block shadow-[0_3px_6px_rgba(0,102,204,0.2)] box-border"
                >
                  Restablecer Contraseña
                </Button>
              </Section>

              <Text className="text-[16px] leading-[1.6] m-0 mb-[15px]">
                Si el botón no funciona, puedes copiar y pegar la siguiente URL
                en tu navegador:
              </Text>

              <Text className="m-0 mb-[20px] mt-[10px] py-[12px] px-[15px] bg-[#f5f7fa] rounded-[6px] text-[14px] break-all border-l-[4px] border-l-[#0066cc] text-[#666]">
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
                El equipo de Negoco Cloud
              </Text>
            </Section>

            {/* Footer */}
            <Section className="bg-[#f0f5fc] px-[50px] py-[30px] text-center border-t-[1px] border-t-[#e5ebf5]">
              <Text className="m-0 mb-[15px] text-[#758195] text-[14px]">
                Si tienes alguna duda, contáctanos en{" "}
                <a
                  href="mailto:soporte@negococloud.es"
                  className="text-[#0066cc] no-underline"
                >
                  soporte@negococloud.es
                </a>
              </Text>

              <Text className="m-0 text-[#758195] text-[13px]">
                Este es un correo electrónico automático, por favor no respondas
                a este mensaje.
              </Text>

              <Text className="m-0 mt-[15px] text-[#758195] text-[13px]">
                &copy; {new Date().getFullYear()} Negoco Cloud. Todos los
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

