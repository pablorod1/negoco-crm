import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

interface SupportEmailData {
  subject: string;
  category: string;
  priority: string;
  description: string;
  stepsToReproduce?: string;
  environment?: string;
  userEmail: string;
  userName: string;
  userOrganization: string;
}

const PRIORITY_COLORS = {
  low: "#10b981",
  medium: "#f59e0b",
  high: "#f97316",
  critical: "#ef4444",
};

const PRIORITY_LABELS = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  critical: "Crítica",
};

const CATEGORY_LABELS = {
  bug: "Error/Bug",
  feature: "Solicitud de funcionalidad",
  performance: "Problema de rendimiento",
  security: "Problema de seguridad",
  integration: "Problema de integración",
  ui: "Problema de interfaz",
  data: "Problema con datos",
  other: "Otros",
};

function generateEmailHTML(data: SupportEmailData): string {
  const priorityColor =
    PRIORITY_COLORS[data.priority as keyof typeof PRIORITY_COLORS] || "#6b7280";
  const priorityLabel =
    PRIORITY_LABELS[data.priority as keyof typeof PRIORITY_LABELS] ||
    data.priority;
  const categoryLabel =
    CATEGORY_LABELS[data.category as keyof typeof CATEGORY_LABELS] ||
    data.category;

  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nueva Incidencia de Soporte</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb;">
    <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
        
        <!-- Header -->
        <div style="background-color: #111827; padding: 24px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">Nueva Incidencia de Soporte</h1>
            <p style="color: #d1d5db; margin: 8px 0 0 0; font-size: 14px;">NegocoCloud CRM</p>
        </div>

        <!-- Content -->
        <div style="padding: 32px;">
            
            <!-- Priority Badge -->
            <div style="margin-bottom: 24px;">
                <span style="
                    display: inline-block;
                    padding: 6px 12px;
                    background-color: ${priorityColor}20;
                    color: ${priorityColor};
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: 600;
                    text-transform: uppercase;
                    border: 1px solid ${priorityColor}40;
                ">
                    🚨 Prioridad: ${priorityLabel}
                </span>
            </div>

            <!-- Subject -->
            <div style="margin-bottom: 24px;">
                <h2 style="color: #111827; margin: 0 0 8px 0; font-size: 20px; font-weight: 600;">
                    ${data.subject}
                </h2>
                <p style="color: #6b7280; margin: 0; font-size: 14px;">
                    Categoría: ${categoryLabel}
                </p>
            </div>

            <!-- User Info -->
            <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
                <h3 style="color: #374151; margin: 0 0 12px 0; font-size: 14px; font-weight: 600;">Información del Usuario</h3>
                <div style="display: grid; gap: 8px;">
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #6b7280; font-size: 13px;">Nombre:</span>
                        <span style="color: #111827; font-size: 13px; font-weight: 500;">${data.userName}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #6b7280; font-size: 13px;">Email:</span>
                        <span style="color: #111827; font-size: 13px; font-weight: 500;">${data.userEmail}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #6b7280; font-size: 13px;">Organización:</span>
                        <span style="color: #111827; font-size: 13px; font-weight: 500;">${data.userOrganization || "N/A"}</span>
                    </div>
                    ${
                      data.environment
                        ? `
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #6b7280; font-size: 13px;">Entorno:</span>
                        <span style="color: #111827; font-size: 13px; font-weight: 500;">${data.environment}</span>
                    </div>
                    `
                        : ""
                    }
                </div>
            </div>

            <!-- Description -->
            <div style="margin-bottom: 24px;">
                <h3 style="color: #374151; margin: 0 0 12px 0; font-size: 16px; font-weight: 600;">Descripción del Problema</h3>
                <div style="background-color: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px;">
                    <p style="color: #111827; margin: 0; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${data.description}</p>
                </div>
            </div>

            <!-- Steps to Reproduce -->
            ${
              data.stepsToReproduce
                ? `
            <div style="margin-bottom: 24px;">
                <h3 style="color: #374151; margin: 0 0 12px 0; font-size: 16px; font-weight: 600;">Pasos para Reproducir</h3>
                <div style="background-color: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 16px;">
                    <p style="color: #92400e; margin: 0; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${data.stepsToReproduce}</p>
                </div>
            </div>
            `
                : ""
            }

            <!-- Timestamp -->
            <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 32px;">
                <p style="color: #6b7280; margin: 0; font-size: 12px; text-align: center;">
                    Incidencia reportada el ${new Date().toLocaleString(
                      "es-ES",
                      {
                        timeZone: "Europe/Madrid",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }
                    )}
                </p>
            </div>

        </div>

        <!-- Footer -->
        <div style="background-color: #f9fafb; padding: 16px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; margin: 0; font-size: 12px;">
                Este email ha sido generado automáticamente por el sistema de soporte de NegocoCloud CRM.
            </p>
        </div>

    </div>
</body>
</html>
  `.trim();
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const emailData: SupportEmailData = {
      subject: formData.get("subject") as string,
      category: formData.get("category") as string,
      priority: formData.get("priority") as string,
      description: formData.get("description") as string,
      stepsToReproduce: formData.get("stepsToReproduce") as string,
      environment: formData.get("environment") as string,
      userEmail: formData.get("userEmail") as string,
      userName: formData.get("userName") as string,
      userOrganization: formData.get("userOrganization") as string,
    };

    // Validate required fields
    if (
      !emailData.subject ||
      !emailData.category ||
      !emailData.priority ||
      !emailData.description
    ) {
      return NextResponse.json(
        { success: false, error: "Faltan campos obligatorios" },
        { status: 400 }
      );
    }

    // Create transporter for sending emails
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Collect attachments
    const attachments: Array<{
      filename: string;
      content: Buffer;
      contentType: string;
    }> = [];
    const attachmentKeys = Array.from(formData.keys()).filter((key) =>
      key.startsWith("attachment_")
    );

    for (const key of attachmentKeys) {
      const file = formData.get(key) as File;
      if (file && file.size > 0) {
        const buffer = Buffer.from(await file.arrayBuffer());
        attachments.push({
          filename: file.name,
          content: buffer,
          contentType: file.type,
        });
      }
    }

    // Generate email content
    const htmlContent = generateEmailHTML(emailData);
    const priorityLabel =
      PRIORITY_LABELS[emailData.priority as keyof typeof PRIORITY_LABELS] ||
      emailData.priority;

    // Email subject with priority
    const emailSubject = `[${priorityLabel}] ${emailData.subject} - ${emailData.userName}`;

    // Send email
    await transporter.sendMail({
      from: `"NegocoCloud CRM Soporte" <${process.env.SMTP_USER}>`,
      to: "soporte@negococloud.es",
      subject: emailSubject,
      html: htmlContent,
      attachments: attachments,
      replyTo: emailData.userEmail,
    });

    // Send confirmation email to user
    const confirmationHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Confirmación de Incidencia</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb; margin: 0; padding: 20px;">
    <div style="max-width: 500px; margin: 0 auto; background-color: white; border-radius: 8px; padding: 24px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
        
        <div style="text-align: center; margin-bottom: 24px;">
            <h2 style="color: #111827; margin: 0; font-size: 20px;">✅ Incidencia Recibida</h2>
        </div>

        <p style="color: #374151; margin-bottom: 16px;">Hola ${emailData.userName},</p>
        
        <p style="color: #374151; margin-bottom: 16px;">
            Hemos recibido tu incidencia <strong>"${emailData.subject}"</strong> y nuestro equipo técnico la revisará lo antes posible.
        </p>

        <div style="background-color: #f3f4f6; padding: 16px; border-radius: 6px; margin-bottom: 16px;">
            <p style="color: #374151; margin: 0; font-size: 14px;">
                <strong>Prioridad:</strong> ${priorityLabel}<br>
                <strong>Categoría:</strong> ${CATEGORY_LABELS[emailData.category as keyof typeof CATEGORY_LABELS] || emailData.category}
            </p>
        </div>

        <p style="color: #374151; margin-bottom: 16px;">
            Recibirás una respuesta en tu email <strong>${emailData.userEmail}</strong> en breve.
        </p>

        <p style="color: #6b7280; font-size: 12px; text-align: center; margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
            Gracias por usar NegocoCloud CRM
        </p>

    </div>
</body>
</html>
    `.trim();

    await transporter.sendMail({
      from: `"NegocoCloud CRM" <${process.env.SMTP_USER}>`,
      to: emailData.userEmail,
      subject: `Confirmación: ${emailData.subject}`,
      html: confirmationHTML,
    });

    return NextResponse.json({
      success: true,
      message: "Incidencia enviada correctamente",
    });
  } catch (error) {
    console.error("Error enviando email de soporte:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error interno del servidor",
      },
      { status: 500 }
    );
  }
}
