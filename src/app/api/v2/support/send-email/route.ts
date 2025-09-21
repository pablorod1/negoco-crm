import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

interface SupportEmailData {
  subject: string;
  message: string;
  userEmail: string;
  userName: string;
  userOrganization: string;
}

function generateSupportEmailHTML(data: SupportEmailData): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nueva Consulta de Soporte - ${data.subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f7f9fc;">
    <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        
        <!-- Header -->
        <div style="background-color: #f0f6ff; padding: 30px; text-align: center;">
            <img src="https://negococloud.es/favicon.png" alt="Negoco Cloud Logo" style="height: 50px;">
        </div>

        <!-- Content -->
        <div style="padding: 40px;">
            
            <!-- Title -->
            <h1 style="color: #3b82f6; margin: 0 0 20px 0; font-size: 24px; font-weight: 600; text-align: center;">
                Nueva Consulta de Soporte
            </h1>

            <p style="color: #4b5563; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; text-align: center;">
                Has recibido una nueva consulta de soporte.
            </p>

            <!-- User Info -->
            <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                <h3 style="color: #374151; margin: 0 0 15px 0; font-size: 16px; font-weight: 600;">Información del Usuario:</h3>
                <div style="display: grid; gap: 8px;">
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #6b7280; font-size: 14px;">Nombre:</span>
                        <span style="color: #111827; font-size: 14px; font-weight: 500;">${data.userName}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #6b7280; font-size: 14px;">Email:</span>
                        <span style="color: #111827; font-size: 14px; font-weight: 500;">${data.userEmail}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #6b7280; font-size: 14px;">Organización:</span>
                        <span style="color: #111827; font-size: 14px; font-weight: 500;">${data.userOrganization || "N/A"}</span>
                    </div>
                </div>
            </div>

            <!-- Subject -->
            <div style="margin-bottom: 20px;">
                <h3 style="color: #374151; margin: 0 0 10px 0; font-size: 16px; font-weight: 600;">Asunto:</h3>
                <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px;">
                    <p style="color: #111827; margin: 0; font-size: 16px; line-height: 1.5;">${data.subject}</p>
                </div>
            </div>

            <!-- Message -->
            <div style="margin-bottom: 20px;">
                <h3 style="color: #374151; margin: 0 0 10px 0; font-size: 16px; font-weight: 600;">Mensaje:</h3>
                <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px;">
                    <p style="color: #111827; margin: 0; font-size: 16px; line-height: 1.6; white-space: pre-wrap;">${data.message}</p>
                </div>
            </div>

            <!-- Instructions -->
            <div style="text-align: center; margin-top: 30px;">
                <p style="color: #4b5563; margin: 0; font-size: 16px; line-height: 1.6;">
                    Responde directamente a este correo para contactar con el usuario.
                </p>
            </div>

        </div>

        <!-- Footer -->
        <div style="background-color: #f0f5fc; border-top: 1px solid #e5ebf5; padding: 30px; text-center;">
            <p style="color: #758195; margin: 0 0 15px 0; font-size: 14px;">
                Puedes responder directamente a 
                <a href="mailto:${data.userEmail}" style="color: #3b82f6; text-decoration: none;">${data.userEmail}</a>
            </p>

            <p style="color: #758195; margin: 0; font-size: 13px;">
                Este correo fue generado automáticamente desde el sistema de soporte de Negoco Cloud CRM.
            </p>

            <p style="color: #758195; margin: 15px 0 0 0; font-size: 13px;">
                &copy; ${new Date().getFullYear()} Negoco Cloud. Todos los derechos reservados.
            </p>
        </div>

    </div>
</body>
</html>
  `.trim();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const emailData: SupportEmailData = {
      subject: body.subject,
      message: body.message,
      userEmail: body.userEmail,
      userName: body.userName,
      userOrganization: body.userOrganization,
    };

    // Validate required fields
    if (
      !emailData.subject ||
      !emailData.message ||
      !emailData.userEmail ||
      !emailData.userName
    ) {
      return NextResponse.json(
        { success: false, error: "Faltan campos obligatorios" },
        { status: 400 }
      );
    }

    const email = process.env.EMAIL;
    const password = process.env.EMAIL_PASS;

    // Create transporter for sending emails
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: 465,
      secure: true,
      auth: {
        user: email,
        pass: password,
      },
    });

    // Generate email content
    const htmlContent = generateSupportEmailHTML(emailData);

    // Email subject
    const emailSubject = `[Soporte] ${emailData.subject} - ${emailData.userName}`;

    // Send email to support
    const mailOptions = {
      from: {
        address: email as string,
        name: "Soporte Negoco Cloud",
      },
      to: "soporte@negococloud.es",
      subject: emailSubject,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);

    return NextResponse.json({
      success: true,
      message: "Correo enviado correctamente",
      messageId: info.messageId,
    });
  } catch (error) {
    console.error("Error enviando correo de soporte:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error interno del servidor",
      },
      { status: 500 }
    );
  }
}
