import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Tailwind,
  Hr,
  Row,
  Column,
  render,
} from "@react-email/components";
import nodemailer from "nodemailer";

export async function sendUpgradePlanEmail({
  user,
  plan,
}: {
  user: { name: string; email: string; company: string };
  plan: { old: string; new: string };
}) {
  const email = process.env.EMAIL_NOREPLY;
  const password = process.env.EMAIL_PASS_NOREPLY;
  const smtpHost = process.env.SMTP_HOST;

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: 465,
    secure: true,
    auth: {
      user: email,
      pass: password,
    },
  });

  const emailHtml = await render(
    <UpgradeRequestEmail
      customerEmail={user.email}
      customerName={user.name}
      companyName={user.company}
      currentPlan={plan.old}
      requestedPlan={plan.new}
    />,
  );

  const mailOptions = {
    from: {
      address: email as string,
      name: "Negoco Cloud",
    },
    to: "info@negococloud.es",
    subject: `Solicitud de Mejora de Suscripción - ${user.name}`,
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

interface Props {
  customerName: string;
  companyName: string;
  customerEmail: string;
  currentPlan: string;
  requestedPlan: string;
}

const UpgradeRequestEmail = ({
  customerEmail,
  customerName,
  companyName,
  currentPlan,
  requestedPlan,
}: Props) => {
  return (
    <Html lang="es" dir="ltr">
      <Tailwind>
        <Head />
        <Preview>Solicitud de mejora de suscripción - {customerName}</Preview>
        <Body className="bg-gray-100 font-sans py-[40px]">
          <Container className="bg-white mx-auto px-[32px] py-[40px] rounded-[8px] max-w-[600px]">
            {/* Header */}
            <Section>
              <Heading className="text-[24px] font-bold text-gray-900 mb-[24px] text-center">
                🚀 Nueva Solicitud de Mejora de Suscripción
              </Heading>
              <Hr className="border-gray-200 my-[24px]" />
            </Section>

            {/* Main Content */}
            <Section>
              <Text className="text-[16px] text-gray-700 mb-[24px] leading-[24px]">
                Hola equipo de dirección,
              </Text>

              <Text className="text-[16px] text-gray-700 mb-[24px] leading-[24px]">
                Tenemos una excelente noticia: un cliente ha solicitado mejorar
                su suscripción actual. A continuación encontrarás todos los
                detalles relevantes para procesar esta solicitud.
              </Text>
            </Section>

            {/* Customer Information */}
            <Section className="bg-blue-50 p-[24px] rounded-[8px] mb-[24px]">
              <Heading className="text-[18px] font-bold text-blue-900 mb-[16px]">
                📋 Información del Cliente
              </Heading>

              <Row>
                <Column>
                  <Text className="text-[14px] text-gray-600 mb-[4px] font-semibold">
                    Nombre del Cliente:
                  </Text>
                  <Text className="text-[16px] text-gray-900 mb-[12px]">
                    {customerName}
                  </Text>
                </Column>
              </Row>

              <Row>
                <Column>
                  <Text className="text-[14px] text-gray-600 mb-[4px] font-semibold">
                    Empresa:
                  </Text>
                  <Text className="text-[16px] text-gray-900 mb-[12px]">
                    {companyName}
                  </Text>
                </Column>
              </Row>

              <Row>
                <Column>
                  <Text className="text-[14px] text-gray-600 mb-[4px] font-semibold">
                    Email de Contacto:
                  </Text>
                  <Text className="text-[16px] text-gray-900 mb-[12px]">
                    {customerEmail}
                  </Text>
                </Column>
              </Row>
            </Section>

            {/* Plan Information */}
            <Section className="bg-green-50 p-[24px] rounded-[8px] mb-[24px]">
              <Heading className="text-[18px] font-bold text-green-900 mb-[16px]">
                📊 Detalles de la Mejora
              </Heading>

              <Row className="mb-[16px]">
                <Column className="w-1/2 pr-[12px]">
                  <Text className="text-[14px] text-gray-600 mb-[4px] font-semibold">
                    Plan Actual:
                  </Text>
                  <Text className="text-[16px] text-red-700 font-semibold bg-red-100 px-[12px] py-[8px] rounded-[4px] inline-block">
                    {currentPlan}
                  </Text>
                </Column>
                <Column className="w-1/2 pl-[12px]">
                  <Text className="text-[14px] text-gray-600 mb-[4px] font-semibold">
                    Plan Solicitado:
                  </Text>
                  <Text className="text-[16px] text-green-700 font-semibold bg-green-100 px-[12px] py-[8px] rounded-[4px] inline-block">
                    {requestedPlan}
                  </Text>
                </Column>
              </Row>
            </Section>

            {/* Next Steps */}
            <Section className="bg-yellow-50 p-[24px] rounded-[8px] mb-[24px]">
              <Heading className="text-[18px] font-bold text-yellow-900 mb-[16px]">
                ⚡ Próximos Pasos Recomendados
              </Heading>

              <Text className="text-[14px] text-gray-700 mb-[8px]">
                • Revisar el historial de pagos del cliente
              </Text>
              <Text className="text-[14px] text-gray-700 mb-[8px]">
                • Contactar al cliente para confirmar la solicitud
              </Text>
              <Text className="text-[14px] text-gray-700 mb-[8px]">
                • Procesar la actualización del plan
              </Text>
              <Text className="text-[14px] text-gray-700 mb-[8px]">
                • Enviar confirmación de la mejora
              </Text>
            </Section>

            {/* Call to Action */}
            <Section className="text-center mb-[32px]">
              <Text className="text-[16px] text-gray-700 mb-[16px]">
                Por favor, procesa esta solicitud con la mayor brevedad posible
                para mantener la satisfacción del cliente.
              </Text>
            </Section>

            <Hr className="border-gray-200 my-[24px]" />

            {/* Footer */}
            <Section>
              <Text className="text-[12px] text-gray-500 text-center m-0">
                El equipo de Negoco Cloud
              </Text>

              <Text className="text-[12px] text-gray-500 text-center m-0">
                © 2025 - Todos los derechos reservados
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

UpgradeRequestEmail.PreviewProps = {
  customerName: "María García López",
  companyName: "Innovación Digital SL",
  customerEmail: "maria.garcia@innovaciondigital.com",
  currentPlan: "Plan Básico",
  requestedPlan: "Plan Premium",
};

export default UpgradeRequestEmail;
