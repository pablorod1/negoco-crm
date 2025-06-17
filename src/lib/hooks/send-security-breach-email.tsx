import * as React from "react";
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

export async function sendSecurityBreachEmail({
  securityEvent,
}: {
  securityEvent: {
    type:
      | "RATE_LIMIT"
      | "SQL_INJECTION"
      | "XSS_ATTEMPT"
      | "INVALID_INPUT"
      | "UNAUTHORIZED_ACCESS"
      | "QUERY_TIMEOUT"
      | "SUSPICIOUS_PATTERN";
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    userId?: string;
    userRole?: string;
    ip: string;
    userAgent?: string;
    details: string;
    timestamp: Date;
    userName?: string;
    userEmail?: string;
  };
}) {
  const email = process.env.EMAIL;
  const password = process.env.EMAIL_PASS;

  if (!email || !password) {
    console.error("Email credentials not configured");
    throw new Error("Email credentials not configured");
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: 465,
    secure: true,
    auth: {
      user: email,
      pass: password,
    },
  });

  const emailHtml = await render(
    <SecurityBreachEmail
      eventType={securityEvent.type}
      severity={securityEvent.severity}
      userId={securityEvent.userId}
      userRole={securityEvent.userRole}
      userName={securityEvent.userName}
      userEmail={securityEvent.userEmail}
      ipAddress={securityEvent.ip}
      userAgent={securityEvent.userAgent}
      details={securityEvent.details}
      timestamp={securityEvent.timestamp}
    />
  );

  const mailOptions = {
    from: {
      address: email as string,
      name: "Negoco Cloud Security",
    },
    to: process.env.EMAIL,
    subject: `🚨 ALERTA DE SEGURIDAD: ${securityEvent.type} - Severidad ${securityEvent.severity}`,
    html: emailHtml,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (error) {
    console.error("Error al enviar el email de seguridad:", error);
    throw new Error("No se pudo enviar el correo de seguridad");
  }
}

interface Props {
  eventType: string;
  severity: string;
  userId?: string;
  userRole?: string;
  userName?: string;
  userEmail?: string;
  ipAddress: string;
  userAgent?: string;
  details: string;
  timestamp: Date;
}

const SecurityBreachEmail = ({
  eventType,
  severity,
  userId,
  userRole,
  userName,
  userEmail,
  ipAddress,
  userAgent,
  details,
  timestamp,
}: Props) => {
  const getSeverityColor = (sev: string) => {
    switch (sev) {
      case "CRITICAL":
        return { bg: "bg-red-100", text: "text-red-900", badge: "bg-red-600" };
      case "HIGH":
        return {
          bg: "bg-orange-100",
          text: "text-orange-900",
          badge: "bg-orange-600",
        };
      case "MEDIUM":
        return {
          bg: "bg-yellow-100",
          text: "text-yellow-900",
          badge: "bg-yellow-600",
        };
      case "LOW":
        return {
          bg: "bg-blue-100",
          text: "text-blue-900",
          badge: "bg-blue-600",
        };
      default:
        return {
          bg: "bg-gray-100",
          text: "text-gray-900",
          badge: "bg-gray-600",
        };
    }
  };

  const getEventTypeDescription = (type: string) => {
    switch (type) {
      case "SQL_INJECTION":
        return "Intento de Inyección SQL";
      case "XSS_ATTEMPT":
        return "Intento de Ataque XSS";
      case "UNAUTHORIZED_ACCESS":
        return "Acceso No Autorizado";
      case "RATE_LIMIT":
        return "Violación de Límite de Velocidad";
      case "SUSPICIOUS_PATTERN":
        return "Patrón Sospechoso Detectado";
      case "INVALID_INPUT":
        return "Entrada Inválida";
      case "QUERY_TIMEOUT":
        return "Consulta con Timeout";
      default:
        return type.replace(/_/g, " ");
    }
  };

  const getRecommendedActions = (type: string) => {
    switch (type) {
      case "SQL_INJECTION":
        return [
          "Revisar inmediatamente la cuenta del usuario",
          "Bloquear la dirección IP si continúan los intentos",
          "Verificar la integridad de la base de datos",
          "Actualizar las reglas de protección SQL",
        ];
      case "XSS_ATTEMPT":
        return [
          "Revisar las reglas de validación de entrada",
          "Verificar la configuración de CSP",
          "Monitorear al usuario por intentos adicionales",
          "Considerar suspensión temporal si persiste",
        ];
      case "UNAUTHORIZED_ACCESS":
        return [
          "Verificar las credenciales del usuario",
          "Revisar los permisos de acceso",
          "Considerar compromiso de cuenta",
          "Implementar autenticación adicional",
        ];
      case "RATE_LIMIT":
        return [
          "Monitorear la IP por violaciones continuas",
          "Verificar si es tráfico legítimo",
          "Considerar implementar CAPTCHA",
          "Ajustar los límites si es necesario",
        ];
      default:
        return [
          "Revisar los logs de seguridad",
          "Investigar el patrón detectado",
          "Considerar medidas de seguridad adicionales",
          "Monitorear actividad futura",
        ];
    }
  };

  const colors = getSeverityColor(severity);

  return (
    <Html lang="es" dir="ltr">
      <Tailwind>
        <Head />
        <Preview>
          🚨 Alerta de Seguridad: {getEventTypeDescription(eventType)} -{" "}
          {severity}
        </Preview>
        <Body className="bg-gray-100 font-sans py-[40px]">
          <Container className="bg-white mx-auto px-[32px] py-[40px] rounded-[8px] max-w-[700px]">
            {/* Header */}
            <Section>
              <div className="text-center mb-[24px]">
                <div
                  className={`inline-block px-[16px] py-[8px] rounded-[4px] ${colors.badge} text-white font-bold text-[14px] mb-[16px]`}
                >
                  SEVERIDAD: {severity}
                </div>
                <Heading className="text-[28px] font-bold text-gray-900 mb-[8px]">
                  🚨 Alerta de Seguridad
                </Heading>
                <Text className="text-[18px] text-gray-700 font-semibold">
                  {getEventTypeDescription(eventType)}
                </Text>
              </div>
              <Hr className="border-gray-300 my-[24px]" />
            </Section>

            {/* Event Summary */}
            <Section
              className={`${colors.bg} p-[24px] rounded-[8px] mb-[24px] border-l-4 ${colors.badge.replace("bg-", "border-")}`}
            >
              <Heading
                className={`text-[20px] font-bold ${colors.text} mb-[16px]`}
              >
                📊 Resumen del Evento
              </Heading>

              <Row className="mb-[12px]">
                <Column className="w-1/3">
                  <Text className="text-[14px] text-gray-600 font-semibold mb-[4px]">
                    Tipo de Evento:
                  </Text>
                  <Text className="text-[16px] text-gray-900">
                    {getEventTypeDescription(eventType)}
                  </Text>
                </Column>
                <Column className="w-1/3">
                  <Text className="text-[14px] text-gray-600 font-semibold mb-[4px]">
                    Fecha y Hora:
                  </Text>
                  <Text className="text-[16px] text-gray-900">
                    {timestamp.toLocaleString("es-ES")}
                  </Text>
                </Column>
                <Column className="w-1/3">
                  <Text className="text-[14px] text-gray-600 font-semibold mb-[4px]">
                    Dirección IP:
                  </Text>
                  <Text className="text-[16px] text-gray-900 font-mono">
                    {ipAddress}
                  </Text>
                </Column>
              </Row>
            </Section>

            {/* User Information */}
            {(userId || userEmail || userName) && (
              <Section className="bg-blue-50 p-[24px] rounded-[8px] mb-[24px]">
                <Heading className="text-[18px] font-bold text-blue-900 mb-[16px]">
                  👤 Información del Usuario
                </Heading>

                {userName && (
                  <Row className="mb-[12px]">
                    <Column>
                      <Text className="text-[14px] text-gray-600 mb-[4px] font-semibold">
                        Nombre:
                      </Text>
                      <Text className="text-[16px] text-gray-900">
                        {userName}
                      </Text>
                    </Column>
                  </Row>
                )}

                {userEmail && (
                  <Row className="mb-[12px]">
                    <Column>
                      <Text className="text-[14px] text-gray-600 mb-[4px] font-semibold">
                        Email:
                      </Text>
                      <Text className="text-[16px] text-gray-900">
                        {userEmail}
                      </Text>
                    </Column>
                  </Row>
                )}

                {userId && (
                  <Row className="mb-[12px]">
                    <Column className="w-1/2">
                      <Text className="text-[14px] text-gray-600 mb-[4px] font-semibold">
                        ID de Usuario:
                      </Text>
                      <Text className="text-[16px] text-gray-900 font-mono">
                        {userId}
                      </Text>
                    </Column>
                    {userRole && (
                      <Column className="w-1/2">
                        <Text className="text-[14px] text-gray-600 mb-[4px] font-semibold">
                          Rol:
                        </Text>
                        <Text className="text-[16px] text-gray-900">
                          {userRole}
                        </Text>
                      </Column>
                    )}
                  </Row>
                )}
              </Section>
            )}

            {/* Technical Details */}
            <Section className="bg-gray-50 p-[24px] rounded-[8px] mb-[24px]">
              <Heading className="text-[18px] font-bold text-gray-900 mb-[16px]">
                🔍 Detalles Técnicos
              </Heading>

              <Row className="mb-[16px]">
                <Column>
                  <Text className="text-[14px] text-gray-600 mb-[4px] font-semibold">
                    Descripción del Evento:
                  </Text>
                  <Text className="text-[16px] text-gray-900 bg-white p-[12px] rounded-[4px] border font-mono">
                    {details}
                  </Text>
                </Column>
              </Row>

              {userAgent && (
                <Row>
                  <Column>
                    <Text className="text-[14px] text-gray-600 mb-[4px] font-semibold">
                      User Agent:
                    </Text>
                    <Text className="text-[14px] text-gray-700 bg-white p-[12px] rounded-[4px] border font-mono break-words">
                      {userAgent}
                    </Text>
                  </Column>
                </Row>
              )}
            </Section>

            {/* Recommended Actions */}
            <Section className="bg-orange-50 p-[24px] rounded-[8px] mb-[24px]">
              <Heading className="text-[18px] font-bold text-orange-900 mb-[16px]">
                ⚡ Acciones Recomendadas
              </Heading>

              {getRecommendedActions(eventType).map((action, index) => (
                <Text
                  key={index}
                  className="text-[14px] text-gray-700 mb-[8px] flex items-start"
                >
                  <span className="text-orange-600 mr-[8px] font-bold">•</span>
                  {action}
                </Text>
              ))}
            </Section>

            {/* Urgency Notice */}
            {(severity === "CRITICAL" || severity === "HIGH") && (
              <Section className="bg-red-50 border-2 border-red-200 p-[24px] rounded-[8px] mb-[24px]">
                <Heading className="text-[18px] font-bold text-red-900 mb-[12px]">
                  🚨 ATENCIÓN INMEDIATA REQUERIDA
                </Heading>
                <Text className="text-[16px] text-red-800">
                  Este evento de seguridad requiere atención inmediata. Por
                  favor, revisa y toma las medidas necesarias lo antes posible
                  para proteger el sistema y los datos.
                </Text>
              </Section>
            )}

            <Hr className="border-gray-200 my-[32px]" />

            {/* Footer */}
            <Section>
              <Text className="text-[14px] text-gray-600 text-center mb-[8px]">
                Esta alerta fue generada automáticamente por el sistema de
                seguridad de Negoco Cloud
              </Text>
              <Text className="text-[12px] text-gray-500 text-center m-0">
                Sistema de Monitoreo de Seguridad - Negoco Cloud
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

SecurityBreachEmail.PreviewProps = {
  eventType: "SQL_INJECTION",
  severity: "CRITICAL",
  userId: "user_123456",
  userRole: "commercial",
  userName: "Juan Pérez",
  userEmail: "juan.perez@example.com",
  ipAddress: "192.168.1.100",
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  details:
    "Intento de inyección SQL detectado en consulta del chatbot: UNION SELECT * FROM users",
  timestamp: new Date(),
};

export default SecurityBreachEmail;
