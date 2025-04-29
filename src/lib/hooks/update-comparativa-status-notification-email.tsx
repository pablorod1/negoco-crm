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

export async function sendComparativaStatusUpdatedNotification({
  user_to,
  comparativa_id,
  status,
  link,
  req,
  comparativa_name,
}: {
  user_to: { name: string; email: string; org_logo: string | undefined };
  comparativa_id: string;
  status: { old: string; new: string };
  link: string;
  req: NextRequest;
  comparativa_name: string;
}) {
  // Configurar el transporter de nodemailer
  const host = req.headers.get("host");
  if (!host) {
    throw new Error("No host found in request headers");
  }

  // Extraer el subdominio (client1, client2, etc.)
  const subdomain = host.split(".")[0];
  const email =
    subdomain === "beenergy"
      ? process.env.EMAIL_BEENERGY
      : process.env.EMAIL_NOREPLY;
  const password =
    subdomain === "beenergy"
      ? process.env.EMAIL_PASS_BEENERGY
      : process.env.EMAIL_PASS_NOREPLY;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: 465,
    secure: true,
    auth: {
      user: email,
      pass: password,
    },
  });

  const comparativaLink = `${link}/comparativas/${comparativa_id}`;

  const emailHtml = await render(
    <ComparativaStatusUpdateEmail
      name={user_to.name}
      comparativaLink={comparativaLink}
      status={status}
      org_logo={user_to.org_logo}
      subdomain={subdomain}
      comparativa_name={comparativa_name}
    />
  );

  const mailOptions = {
    from: {
      address: email as string,
      name: subdomain.toUpperCase(),
    },
    to: user_to.email,
    subject: `Actualización de Comparativa - ${comparativa_name}`,
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

const ComparativaStatusUpdateEmail = ({
  name,
  comparativaLink,
  status,
  org_logo,
  subdomain,
  comparativa_name,
}: {
  name: string;
  comparativaLink: string;
  status: { old: string; new: string };
  org_logo: string | undefined;
  subdomain: string;
  comparativa_name: string;
}) => {
  const formatStatus = (status: string) => {
    switch (status) {
      case "pending":
        return "Pendiente de Estudio";
      case "completed":
        return "Estudio Realizado";
      case "processed":
        return "Completada";
      case "rejected":
        return "Comparativa Rechazada";
      default:
        return status;
    }
  };
  return (
    <Html lang="es">
      <Head>
        <title>Actualización de Comparativa - {comparativa_name}</title>
      </Head>
      <Preview>
        El estado de tu comparativa ha cambiado de {formatStatus(status.old)} a{" "}
        {formatStatus(status.new)}
      </Preview>
      <Tailwind>
        <Body
          className={`${subdomain === "beenergy" ? "bg-[#fffdeb]" : "bg-[#f7f9fc]"} py-[40px] font-sans text-[#333333]`}
        >
          <Container className="mx-auto bg-white rounded-[10px] shadow-lg overflow-hidden max-w-[600px]">
            <Section
              className={`${subdomain === "beenergy" ? "bg-[#f7d43a]" : "bg-[#f0f6ff]"} py-[30px] text-center`}
            >
              <Img
                alt="Logo"
                className="mx-auto"
                height={50}
                src={org_logo ? org_logo : "https://negococloud.es/favicon.png"}
              />
            </Section>

            <Section className="px-[50px] py-[40px] text-center">
              <Heading
                className={`${subdomain === "beenergy" ? "text-[#f7d43a]" : "text-[#3b82f6]"} text-[24px] font-semibold m-0 mb-[20px]`}
              >
                Actualización de Comparativa - {comparativa_name}
              </Heading>

              <Text className="text-[16px] leading-[26px] m-0 mb-[15px]">
                Hola {name},
              </Text>

              <Text className="text-[16px] leading-[26px] m-0 mb-[15px]">
                El estado de tu comparativa ha cambiado de{" "}
                <strong>{formatStatus(status.old)}</strong> a{" "}
                <strong>{formatStatus(status.new)}</strong>.
              </Text>

              <Section className="my-[30px]">
                <Button
                  href={comparativaLink}
                  className={`${subdomain === "beenergy" ? "bg-[#f7d43a]" : "bg-[#3b82f6]"} text-white py-[14px] px-[26px] rounded-[6px] font-semibold text-[16px] no-underline inline-block shadow-md box-border`}
                >
                  Ver Comparativa
                </Button>
              </Section>

              <Text className="text-[16px] leading-[26px] m-0 mb-[15px]">
                Si el botón no funciona, copia y pega el siguiente enlace en tu
                navegador:
              </Text>

              <Text
                className={`my-[10px] mb-[20px] py-[12px] px-[15px] ${subdomain === "beenergy" ? "bg-[#fdf7c8] border-[#f7d43a]" : "bg-[#f5f7fa] border-[#0066cc]"} rounded-[6px] text-[14px] border-l-4  text-[#666666] text-left`}
              >
                {comparativaLink}
              </Text>

              <Text className="text-[16px] leading-[26px] mt-[25px] mb-[10px]">
                Saludos,
                <br />
                El equipo de Negoco Cloud
              </Text>
            </Section>

            <Section
              className={`${subdomain === "beenergy" ? "bg-[#fdf7c8] border-[#fdf7c8]" : "bg-[#f0f5fc] border-[#e5ebf5]"} px-[50px] py-[30px] text-center border-t `}
            >
              <Text className="text-[#758195] text-[14px] m-0 mb-[15px]">
                Si tienes alguna duda, contáctanos en{" "}
                <Link
                  href="mailto:soporte@negococloud.es"
                  className={`${subdomain === "beenergy" ? "text-[#f7d43a]" : "text-[#3b82f6]"} no-underline`}
                >
                  soporte@negococloud.es
                </Link>
              </Text>

              <Text className="text-[#758195] text-[13px] m-0">
                Este es un correo electrónico automático, por favor no respondas
                a este mensaje.
              </Text>

              <Text className="text-[#758195] text-[13px] mt-[15px] mb-0 m-0">
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

export default ComparativaStatusUpdateEmail;
