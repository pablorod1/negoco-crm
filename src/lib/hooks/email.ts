import nodemailer from "nodemailer";

export async function sendPasswordResetEmail({
  email,
  resetLink,
}: {
  email: string;
  resetLink: string;
}) {
  // Configurar el transporter de nodemailer
  const transporter = nodemailer.createTransport({
    service: "gmail", // Puedes cambiarlo según el proveedor (Mailgun, SendGrid, etc.)
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  // Crear el template del email con diseño mejorado
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Restablecimiento de Contraseña</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f7f9fc; color: #333333;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f7f9fc; min-width: 320px; margin: 0 auto;">
        <tr>
          <td align="center" style="padding: 40px 10px;">
            <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1); background-color: #ffffff;">
              <!-- Header con logo -->
              <tr>
                <td style="background-color: #f0f6ff; padding: 30px 0; text-align: center;">
                  <img src="https://negococloud.es/favicon.png" alt="Negoco Cloud IT Logo" style="max-width: 220px; height: auto;">
                </td>
              </tr>
              
              <!-- Contenido principal -->
              <tr>
                <td style="padding: 40px 50px;">
                  <h1 style="color: #0066cc; font-size: 24px; margin: 0 0 20px; font-weight: 600; text-align: center;">Restablecimiento de Contraseña</h1>
                  
                  <p style="margin: 0 0 15px; font-size: 16px; line-height: 1.6;">Hola,</p>
                  
                  <p style="margin: 0 0 15px; font-size: 16px; line-height: 1.6;">Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en <strong>Negoco Cloud IT</strong>. Para continuar con este proceso y crear una nueva contraseña, haz clic en el botón de abajo:</p>
                  
                  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 30px 0;">
                    <tr>
                      <td align="center">
                        <a href="${resetLink}" style="background-color: #0066cc; color: #ffffff; padding: 14px 26px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 3px 6px rgba(0, 102, 204, 0.2); transition: all 0.3s;">Restablecer Contraseña</a>
                      </td>
                    </tr>
                  </table>
                  
                  <p style="margin: 0 0 15px; font-size: 16px; line-height: 1.6;">Si el botón no funciona, puedes copiar y pegar la siguiente URL en tu navegador:</p>
                  
                  <p style="margin: 10px 0 20px; padding: 12px 15px; background-color: #f5f7fa; border-radius: 6px; font-size: 14px; word-break: break-all; border-left: 4px solid #0066cc; color: #666;">
                    ${resetLink}
                  </p>
                  
                  <p style="margin: 0 0 15px; font-size: 16px; line-height: 1.6; color: #777777;"><strong>Nota:</strong> Este enlace expirará en 24 horas por motivos de seguridad.</p>
                  
                  <p style="margin: 0 0 15px; font-size: 16px; line-height: 1.6;">Si no has solicitado este cambio de contraseña, puedes ignorar este correo. Tu contraseña actual seguirá siendo válida.</p>
                  
                  <p style="margin: 25px 0 10px; font-size: 16px; line-height: 1.6;">Saludos,<br>El equipo de Negoco Cloud IT</p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f0f5fc; padding: 30px 50px; text-align: center; border-top: 1px solid #e5ebf5;">
                  <p style="margin: 0 0 15px; color: #758195; font-size: 14px;">
                    Si tienes alguna duda, contáctanos en <a href="mailto:soporte@negococloud.es" style="color: #0066cc; text-decoration: none;">soporte@negococloud.es</a>
                  </p>
                  
                  <p style="margin: 0; color: #758195; font-size: 13px;">
                    Este es un correo electrónico automático, por favor no respondas a este mensaje.
                  </p>
                  
                  <p style="margin: 15px 0 0; color: #758195; font-size: 13px;">
                    &copy; ${new Date().getFullYear()} Negoco Cloud IT. Todos los derechos reservados.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  // Configurar el email
  const mailOptions = {
    from: `"Negoco Cloud IT" <noreply@negococloud.es>`,
    to: email,
    subject: `Restablecimiento de contraseña - Negoco Cloud IT`,
    html: htmlContent,
    text: `
      RESTABLECIMIENTO DE CONTRASEÑA - NEGOCO CLOUD IT
      
      Hola,
      
      Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en Negoco Cloud IT.
      
      Para crear una nueva contraseña, visita el siguiente enlace:
      ${resetLink}
      
      Este enlace expirará en 24 horas por motivos de seguridad.
      
      Si no has solicitado este cambio de contraseña, puedes ignorar este correo. Tu contraseña actual seguirá siendo válida.
      
      Saludos,
      El equipo de Negoco Cloud IT
      
      Si tienes alguna duda, contáctanos en soporte@negococloud.es
      
      © ${new Date().getFullYear()} Negoco Cloud IT. Todos los derechos reservados.
    `,
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
