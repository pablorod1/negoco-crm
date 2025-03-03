import nodemailer from "nodemailer";

export async function sendOrganizationInvitation({
  email,
  invitedByUsername,
  invitedByEmail,
  teamName,
  inviteLink,
}: {
  email: string;
  invitedByUsername: string;
  invitedByEmail: string;
  teamName: string;
  inviteLink: string;
}) {
  // Configurar el transporter de nodemailer
  const transporter = nodemailer.createTransport({
    service: "gmail", // Puedes cambiarlo según el proveedor (Mailgun, SendGrid, etc.)
    auth: {
      user: process.env.EMAIL_USER, // Tu dirección de correo electrónico
      pass: process.env.EMAIL_PASS, // La contraseña de tu correo
    },
  });

  // Crear el template del email
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Invitación para unirte a ${teamName}</h2>
      
      <p>Hola,</p>
      
      <p><strong>${invitedByUsername}</strong> (${invitedByEmail}) te ha invitado a unirte a <strong>${teamName}</strong>.</p>
      
      <p>Para aceptar esta invitación, por favor haz clic en el siguiente enlace:</p>
      
      <p style="margin: 25px 0;">
        <a href="${inviteLink}" 
           style="background-color: #4CAF50; 
                  color: white; 
                  padding: 12px 20px; 
                  text-decoration: none; 
                  border-radius: 4px;">
          Aceptar Invitación
        </a>
      </p>
      
      <p>O copia y pega esta URL en tu navegador:</p>
      <p>${inviteLink}</p>
      
      <p>Este enlace expirará en 7 días.</p>
      
      <p>Si no esperabas esta invitación, puedes ignorar este email.</p>
      
      <hr style="margin: 20px 0; border: 1px solid #eee;">
      
      <p style="color: #666; font-size: 12px;">
        Este es un email automático, por favor no respondas a este mensaje.
      </p>
    </div>
  `;

  // Configurar el email
  const mailOptions = {
    from: `"${teamName}" <noreply@example.com>`,
    to: email,
    subject: `Invitación para unirte a ${teamName}`,
    html: htmlContent,
    text: `
      Invitación para unirte a ${teamName}
      
      Hola,
      
      ${invitedByUsername} (${invitedByEmail}) te ha invitado a unirte a ${teamName}.
      
      Para aceptar esta invitación, visita el siguiente enlace:
      ${inviteLink}
      
      Este enlace expirará en 7 días.
      
      Si no esperabas esta invitación, puedes ignorar este email.
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

module.exports = sendOrganizationInvitation;
