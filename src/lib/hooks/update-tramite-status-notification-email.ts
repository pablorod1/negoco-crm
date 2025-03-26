import nodemailer from "nodemailer";

export async function sendTramiteStatusUpdatedNotification({
  user_to,
  tramite_id,
  status,
  link,
}: {
  user_to: { name: string; email: string };
  tramite_id: string;
  status: { old: string; new: string };
  link: string;
}) {
  // Configurar el transporter de nodemailer
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const tramiteLink = `${link}/tramites/${tramite_id}`;

  // Crear el template del email
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Actualización de Trámite</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f7f9fc; color: #333;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f7f9fc; min-width: 320px; margin: 0 auto;">
        <tr>
          <td align="center" style="padding: 40px 10px;">
            <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1); background-color: #ffffff;">
              <tr>
                <td style="background-color: #f0f6ff; padding: 30px 0; text-align: center;">
                  <img src="https://negococloud.es/favicon.png" alt="Negoco Cloud IT Logo" style="max-width: 220px; height: auto;">
                </td>
              </tr>
              <tr>
                <td style="padding: 40px 50px; text-align: center;">
                  <h1 style="color: #0066cc; font-size: 24px; margin: 0 0 20px; font-weight: 600;">Actualización de Trámite</h1>
                  <p style="margin: 0 0 15px; font-size: 16px; line-height: 1.6;">Hola ${
                    user_to.name
                  },</p>
                  <p style="margin: 0 0 15px; font-size: 16px; line-height: 1.6;">El estado de tu trámite ha cambiado de <strong>${
                    status.old
                  }</strong> a <strong>${status.new}</strong>.</p>
                  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 30px 0;">
                    <tr>
                      <td align="center">
                        <a href="${tramiteLink}" style="background-color: #0066cc; color: #ffffff; padding: 14px 26px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 3px 6px rgba(0, 102, 204, 0.2); transition: all 0.3s;">Ver Trámite</a>
                      </td>
                    </tr>
                  </table>
                  <p style="margin: 0 0 15px; font-size: 16px; line-height: 1.6;">Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:</p>
                  <p style="margin: 10px 0 20px; padding: 12px 15px; background-color: #f5f7fa; border-radius: 6px; font-size: 14px; word-break: break-all; border-left: 4px solid #0066cc; color: #666;">${tramiteLink}</p>
                  <p style="margin: 25px 0 10px; font-size: 16px; line-height: 1.6;">Saludos,<br>El equipo de Negoco Cloud IT</p>
                </td>
              </tr>
              <tr>
                <td style="background-color: #f0f5fc; padding: 30px 50px; text-align: center; border-top: 1px solid #e5ebf5;">
                  <p style="margin: 0 0 15px; color: #758195; font-size: 14px;">Si tienes alguna duda, contáctanos en <a href="mailto:soporte@negococloud.es" style="color: #0066cc; text-decoration: none;">soporte@negococloud.es</a></p>
                  <p style="margin: 0; color: #758195; font-size: 13px;">Este es un correo electrónico automático, por favor no respondas a este mensaje.</p>
                  <p style="margin: 15px 0 0; color: #758195; font-size: 13px;">&copy; ${new Date().getFullYear()} Negoco Cloud IT. Todos los derechos reservados.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const mailOptions = {
    from: `"Negoco Cloud IT" <noreply@negococloud.es>`,
    to: user_to.email,
    subject: `Actualización de Trámite - ${status.new}`,
    html: htmlContent,
    text: `
      ACTUALIZACIÓN DE TRÁMITE - NEGOCO CLOUD IT
      
      Hola ${user_to.name},
      
      El estado de tu trámite ha cambiado de ${status.old} a ${status.new}.
      
      Puedes ver los detalles en el siguiente enlace:
      ${tramiteLink}
      
      Saludos,
      El equipo de Negoco Cloud IT
      
      Si tienes alguna duda, contáctanos en soporte@negococloud.es
      
      © ${new Date().getFullYear()} Negoco Cloud IT. Todos los derechos reservados.
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (error) {
    console.error("Error al enviar el email:", error);
    throw new Error("No se pudo enviar el correo");
  }
}
